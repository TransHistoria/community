// DEV ONLY — refuses to run in production.
// Mints an Auth.js DB session for a known email and sets the HttpOnly cookie.
// Used by browser-verification scripts to bypass the magic-link round-trip.

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }
  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.toLowerCase();
  const next = url.searchParams.get("next") ?? "/me";
  if (!email) {
    return NextResponse.json({ error: "?email= required" }, { status: 400 });
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: `No user for ${email}` }, { status: 404 });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.session.create({
    data: { sessionToken: token, userId: user.id, expires },
  });

  const res = NextResponse.redirect(new URL(next, url));
  res.cookies.set({
    name: "authjs.session-token",
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return res;
}
