// Access-control predicates — mirrors src/lib/access/index.ts.

import { TIER_RANK } from "@/lib/enums";
import type { EventRow, ContactMethodRow } from "@/types";

type Viewer = null | { id: string; tier: string };

const VIS_REQUIRED_TIER: Record<string, string> = {
  PUBLIC: "GUEST",
  VERIFIED: "VERIFIED",
  TRUSTED: "TRUSTED",
  HIDDEN_REQUEST: "ADMIN",
};

function rank(tier: string): number {
  return (TIER_RANK[tier] as number | undefined) ?? 0;
}

export function meetsVisibility(viewer: Viewer, visibility: string): boolean {
  const required = VIS_REQUIRED_TIER[visibility] ?? "ADMIN";
  return rank(viewer?.tier ?? "GUEST") >= rank(required);
}

export function canViewEvent(
  viewer: Viewer,
  event: Pick<EventRow, "visibility" | "status" | "organizer_id">,
): boolean {
  if (event.status === "DRAFT") return !!viewer && viewer.id === event.organizer_id;
  if (viewer && viewer.id === event.organizer_id) return true;
  return meetsVisibility(viewer, event.visibility);
}

export function canViewEventDetails(
  viewer: Viewer,
  event: Pick<EventRow, "organizer_id">,
  registrationStatus: string | null,
): boolean {
  if (!viewer) return false;
  if (viewer.id === event.organizer_id) return true;
  if (viewer.tier === "ADMIN") return true;
  return registrationStatus === "CONFIRMED" || registrationStatus === "CHECKED_IN";
}

export function canEditEvent(
  viewer: Viewer,
  event: Pick<EventRow, "organizer_id">,
): boolean {
  if (!viewer) return false;
  return viewer.id === event.organizer_id || viewer.tier === "ADMIN";
}

export function canCreateEvent(viewer: Viewer): boolean {
  if (!viewer) return false;
  return rank(viewer.tier) >= rank("VERIFIED");
}

export function canRegister(
  viewer: Viewer,
  event: Pick<
    EventRow,
    "visibility" | "status" | "registration_opens_at" | "registration_closes_at"
  >,
): { ok: true } | { ok: false; reason: string } {
  if (!viewer) return { ok: false, reason: "请先登录" };
  if (rank(viewer.tier) < rank("VERIFIED"))
    return { ok: false, reason: "需要完成认证后才能报名" };
  if (event.status !== "PUBLISHED")
    return { ok: false, reason: "活动当前不接受报名" };
  if (!meetsVisibility(viewer, event.visibility))
    return { ok: false, reason: "无权访问此活动" };
  const now = new Date().toISOString();
  if (event.registration_opens_at && event.registration_opens_at > now)
    return { ok: false, reason: "报名尚未开始" };
  if (event.registration_closes_at && event.registration_closes_at < now)
    return { ok: false, reason: "报名已截止" };
  return { ok: true };
}

export function canViewContact(
  viewer: Viewer,
  ownerId: string,
  contact: Pick<ContactMethodRow, "visibility">,
  approvedRequest: boolean,
): boolean {
  if (viewer?.id === ownerId) return true;
  if (viewer?.tier === "ADMIN") return true;
  if (contact.visibility === "HIDDEN_REQUEST") return approvedRequest;
  return meetsVisibility(viewer, contact.visibility);
}

export function canViewProfile(
  viewer: Viewer,
  target: { id: string; status: string },
): boolean {
  if (target.status === "DELETED") return false;
  if (target.status === "SUSPENDED") return viewer?.tier === "ADMIN";
  if (!viewer) return false;
  return true;
}

export function canComment(viewer: Viewer): boolean {
  if (!viewer) return false;
  return rank(viewer.tier) >= rank("VERIFIED");
}

export function canModerate(viewer: Viewer): boolean {
  return viewer?.tier === "ADMIN";
}

export function canIssueInvites(viewer: Viewer): boolean {
  if (!viewer) return false;
  return rank(viewer.tier) >= rank("VERIFIED");
}

export function inviteQuotaPerQuarter(tier: string): number {
  switch (tier) {
    case "VERIFIED":
      return 2;
    case "TRUSTED":
      return 5;
    case "ADMIN":
      return 999;
    default:
      return 0;
  }
}
