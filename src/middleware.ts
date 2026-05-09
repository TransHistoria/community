import { NextResponse, type NextRequest } from "next/server";

// Coarse-grained tier gating. Fine-grained checks happen in pages/route handlers.
// We rely on the presence of the next-auth session cookie as a fast path; the
// real tier is enforced by `requireUser()` / `requireTier()` inside protected pages.

const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

function hasSession(req: NextRequest): boolean {
  return SESSION_COOKIES.some((c) => req.cookies.get(c));
}

const PROTECTED_PREFIXES = ["/events", "/u/", "/me", "/notifications", "/admin"];
const PUBLIC_EXACT = ["/", "/about", "/sign-in", "/sign-up", "/apply"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();
  if (PUBLIC_EXACT.includes(pathname)) return NextResponse.next();

  if (!hasSession(req)) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|fonts|images).*)",
  ],
};
