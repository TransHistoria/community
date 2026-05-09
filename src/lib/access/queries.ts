// Prisma `where` builders that bake in viewer-scoped visibility.
// Use these for list queries to avoid leaking restricted records.

import type { Prisma } from "@prisma/client";
import type { UserTier } from "@/lib/enums";
import { TIER_RANK } from "@/lib/session";

type Viewer = null | { id: string; tier: UserTier };

/**
 * Visibility floor for a viewer in list queries:
 *  - GUEST/UNVERIFIED → only PUBLIC
 *  - VERIFIED         → PUBLIC + VERIFIED
 *  - TRUSTED          → PUBLIC + VERIFIED + TRUSTED
 *  - ADMIN            → everything (no filter)
 */
export function visibleEventsWhere(viewer: Viewer): Prisma.EventWhereInput {
  const base: Prisma.EventWhereInput = {
    status: { in: ["PUBLISHED", "FINISHED", "CANCELLED"] },
  };

  if (!viewer) return { ...base, visibility: "PUBLIC" };
  if (viewer.tier === "ADMIN") return base;

  const allowed: Prisma.EventWhereInput["visibility"] = (() => {
    if (TIER_RANK[viewer.tier] >= TIER_RANK["TRUSTED"])
      return { in: ["PUBLIC", "VERIFIED", "TRUSTED"] };
    if (TIER_RANK[viewer.tier] >= TIER_RANK["VERIFIED"])
      return { in: ["PUBLIC", "VERIFIED"] };
    return "PUBLIC";
  })();

  return {
    ...base,
    OR: [
      { visibility: allowed },
      { organizerId: viewer.id },
    ],
  };
}

