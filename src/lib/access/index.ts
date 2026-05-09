// Centralised access-control predicates.
// All visibility/tier rules live here; pages and API routes call into these.
//
// Inputs are typed as `string` (rather than narrowed enum types) so they
// accept Prisma fields directly — SQLite has no DB-level enum, fields come back
// as plain strings. Validation is enforced in zod schemas at API boundaries.

import type { ContactMethod, Event, Registration, User } from "@prisma/client";
import { TIER_RANK } from "@/lib/session";
import type { UserTier } from "@/lib/enums";

type Viewer =
  | null
  | {
      id: string;
      tier: string;
    };

const VIS_REQUIRED_TIER: Record<string, UserTier> = {
  PUBLIC: "GUEST",
  VERIFIED: "VERIFIED",
  TRUSTED: "TRUSTED",
  HIDDEN_REQUEST: "ADMIN", // base tier alone never satisfies; needs explicit grant
};

function rank(tier: string): number {
  return (TIER_RANK as Record<string, number>)[tier] ?? 0;
}

export function viewerTier(viewer: Viewer): string {
  return viewer?.tier ?? "GUEST";
}

export function meetsVisibility(viewer: Viewer, visibility: string): boolean {
  const required = VIS_REQUIRED_TIER[visibility] ?? "ADMIN";
  return rank(viewerTier(viewer)) >= rank(required);
}

// ---------- Events ----------

export function canViewEvent(
  viewer: Viewer,
  event: Pick<Event, "visibility" | "status" | "organizerId">,
): boolean {
  if (event.status === "DRAFT") {
    return !!viewer && viewer.id === event.organizerId;
  }
  if (viewer && viewer.id === event.organizerId) return true;
  return meetsVisibility(viewer, event.visibility);
}

/**
 * The "summary" view is what's safe to show on the index/detail page before
 * registration approval. It excludes preciseAddr and onlineUrl.
 */
export function canViewEventDetails(
  viewer: Viewer,
  event: Pick<Event, "organizerId">,
  registration: Pick<Registration, "status"> | null,
): boolean {
  if (!viewer) return false;
  if (viewer.id === event.organizerId) return true;
  if (viewer.tier === "ADMIN") return true;
  return registration?.status === "CONFIRMED" || registration?.status === "CHECKED_IN";
}

export function canEditEvent(
  viewer: Viewer,
  event: Pick<Event, "organizerId">,
): boolean {
  if (!viewer) return false;
  return viewer.id === event.organizerId || viewer.tier === "ADMIN";
}

export function canCreateEvent(viewer: Viewer): boolean {
  if (!viewer) return false;
  return rank(viewer.tier) >= rank("VERIFIED");
}

export function canRegister(
  viewer: Viewer,
  event: Pick<
    Event,
    "visibility" | "status" | "registrationOpensAt" | "registrationClosesAt"
  >,
): { ok: true } | { ok: false; reason: string } {
  if (!viewer) return { ok: false, reason: "请先登录" };
  if (rank(viewer.tier) < rank("VERIFIED")) {
    return { ok: false, reason: "需要完成认证后才能报名" };
  }
  if (event.status !== "PUBLISHED")
    return { ok: false, reason: "活动当前不接受报名" };
  if (!meetsVisibility(viewer, event.visibility))
    return { ok: false, reason: "无权访问此活动" };
  const now = new Date();
  if (event.registrationOpensAt && event.registrationOpensAt > now)
    return { ok: false, reason: "报名尚未开始" };
  if (event.registrationClosesAt && event.registrationClosesAt < now)
    return { ok: false, reason: "报名已截止" };
  return { ok: true };
}

// ---------- Contacts ----------

export function canViewContact(
  viewer: Viewer,
  ownerId: string,
  contact: Pick<ContactMethod, "visibility">,
  approvedRequest: boolean,
): boolean {
  if (viewer?.id === ownerId) return true;
  if (viewer?.tier === "ADMIN") return true;
  if (contact.visibility === "HIDDEN_REQUEST") return approvedRequest;
  return meetsVisibility(viewer, contact.visibility);
}

// ---------- User profile ----------

export function canViewProfile(
  viewer: Viewer,
  target: Pick<User, "id" | "status">,
): boolean {
  if (target.status === "DELETED") return false;
  if (target.status === "SUSPENDED") return viewer?.tier === "ADMIN";
  if (!viewer) return false;
  return true;
}

// ---------- Comments ----------

export function canComment(viewer: Viewer): boolean {
  if (!viewer) return false;
  return rank(viewer.tier) >= rank("VERIFIED");
}

export function canHideComment(
  viewer: Viewer,
  ctx: { eventOrganizerId: string },
): boolean {
  if (!viewer) return false;
  if (viewer.tier === "ADMIN") return true;
  return viewer.id === ctx.eventOrganizerId;
}

// ---------- Moderation ----------

export function canModerate(viewer: Viewer): boolean {
  return viewer?.tier === "ADMIN";
}

export function canReviewApplications(viewer: Viewer): boolean {
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
