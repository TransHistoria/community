// JWT utilities using the jose library (Edge/Workers compatible).

import { SignJWT, jwtVerify } from "jose";

export interface JwtPayload {
  sub: string; // user ID
  handle: string;
  tier: string;
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

/** Sign a JWT valid for 30 days. */
export async function signJwt(
  payload: JwtPayload,
  secret: string,
): Promise<string> {
  return new SignJWT({ handle: payload.handle, tier: payload.tier })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey(secret));
}

/** Verify and decode a JWT. Returns null if invalid or expired. */
export async function verifyJwt(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(secret));
    if (
      typeof payload.sub !== "string" ||
      typeof payload["handle"] !== "string" ||
      typeof payload["tier"] !== "string"
    ) {
      return null;
    }
    return {
      sub: payload.sub,
      handle: payload["handle"] as string,
      tier: payload["tier"] as string,
    };
  } catch {
    return null;
  }
}
