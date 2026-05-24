// Centralised access-control predicates (client-safe, no Prisma imports).
import { TIER_RANK } from "@/lib/session";
import type { UserTier } from "@/lib/enums";

type Viewer = null | { id: string; tier: string };

type ContactMethodLike = { visibility: string };
type EventLike = {
  visibility: string;
  status: string;
  organizer_id?: string;
  organizerId?: string;
};
type RegistrationLike = { status: string } | null;

const VIS_REQUIRED_TIER: Record<string, UserTier> = {
  PUBLIC: "GUEST",
  VERIFIED: "VERIFIED",
  TRUSTED: "TRUSTED",
  HIDDEN_REQUEST: "ADMIN",
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

export function canViewEvent(viewer: Viewer, event: EventLike): boolean {
  const orgId = event.organizer_id ?? event.organizerId;
  if (event.status === "DRAFT") {
    return !!viewer && viewer.id === orgId;
  }
  if (viewer && viewer.id === orgId) return true;
  return meetsVisibility(viewer, event.visibility);
}

export function canViewEventDetails(
  viewer: Viewer,
  event: { organizer_id?: string; organizerId?: string },
  registration: RegistrationLike,
): boolean {
  if (!viewer) return false;
  const orgId = event.organizer_id ?? event.organizerId;
  if (viewer.id === orgId) return true;
  if (viewer.tier === "ADMIN") return true;
  return registration?.status === "CONFIRMED" || registration?.status === "CHECKED_IN";
}

export function canEditEvent(
  viewer: Viewer,
  event: { organizer_id?: string; organizerId?: string },
): boolean {
  if (!viewer) return false;
  const orgId = event.organizer_id ?? event.organizerId;
  return viewer.id === orgId || viewer.tier === "ADMIN";
}

export function canCreateEvent(viewer: Viewer): boolean {
  if (!viewer) return false;
  // Activities are high-trust (offline meetups, video sessions). Limit to TRUSTED+.
  return rank(viewer.tier) >= rank("TRUSTED");
}

// ---------- Posts (POST / MEDICAL / RESOURCE) ----------

export function canCreatePost(viewer: Viewer): boolean {
  if (!viewer) return false;
  return rank(viewer.tier) >= rank("VERIFIED");
}

export function canEditPost(
  viewer: Viewer,
  post: { author_id?: string; authorId?: string },
): boolean {
  if (!viewer) return false;
  const authorId = post.author_id ?? post.authorId;
  return viewer.id === authorId || viewer.tier === "ADMIN";
}

export function canRegister(
  viewer: Viewer,
  event: {
    visibility: string;
    status: string;
    registration_opens_at?: string | Date | null;
    registration_closes_at?: string | Date | null;
    registrationOpensAt?: Date | null;
    registrationClosesAt?: Date | null;
  },
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
  const opensAt = event.registration_opens_at ?? event.registrationOpensAt;
  const closesAt = event.registration_closes_at ?? event.registrationClosesAt;
  if (opensAt && new Date(opensAt) > now) return { ok: false, reason: "报名尚未开始" };
  if (closesAt && new Date(closesAt) < now) return { ok: false, reason: "报名已截止" };
  return { ok: true };
}

// ---------- Contacts ----------

export function canViewContact(
  viewer: Viewer,
  ownerId: string,
  contact: ContactMethodLike,
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
  target: { id: string; status: string },
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
