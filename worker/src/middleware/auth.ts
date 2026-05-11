// Hono middleware for JWT authentication.

import type { Context, MiddlewareHandler, Next } from "hono";
import { verifyJwt } from "@/auth/jwt";
import type { Env, Variables } from "@/types";

/** Extract Bearer token from Authorization header. */
function extractToken(c: Context): string | null {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

/** Require a valid JWT. Returns 401 if missing or invalid. */
export const requireAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> = async (c, next: Next) => {
  const token = extractToken(c);
  if (!token) {
    return c.json({ error: "未登录" }, 401);
  }
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ error: "登录已过期，请重新登录" }, 401);
  }
  c.set("userId", payload.sub);
  c.set("userTier", payload.tier);
  c.set("userHandle", payload.handle);
  await next();
};

/** Optional auth — populates variables if token is present, does not reject. */
export const optionalAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> = async (c, next: Next) => {
  const token = extractToken(c);
  if (token) {
    const payload = await verifyJwt(token, c.env.JWT_SECRET);
    if (payload) {
      c.set("userId", payload.sub);
      c.set("userTier", payload.tier);
      c.set("userHandle", payload.handle);
    }
  }
  await next();
};

/** Require at least a given tier. Call after requireAuth. */
export function requireTier(minTier: string): MiddlewareHandler<{
  Bindings: Env;
  Variables: Variables;
}> {
  const RANK: Record<string, number> = {
    GUEST: 0,
    UNVERIFIED: 1,
    VERIFIED: 2,
    TRUSTED: 3,
    ADMIN: 4,
  };
  return async (c, next: Next) => {
    const tier = c.get("userTier") ?? "GUEST";
    if ((RANK[tier] ?? 0) < (RANK[minTier] ?? 0)) {
      return c.json({ error: "权限不足" }, 403);
    }
    await next();
  };
}
