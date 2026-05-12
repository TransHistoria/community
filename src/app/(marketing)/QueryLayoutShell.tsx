"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getQueryRoute } from "@/lib/query-routing";

const AUTH_QUERY_ROUTES = new Set([
  "/apply",
  "/apply/pending",
  "/sign-in",
  "/sign-in/check-email",
  "/sign-in/verify",
  "/sign-up",
]);

export default function QueryLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryRoutePath = React.useMemo(
    () => (pathname === "/" ? getQueryRoute(searchParams).path : ""),
    [pathname, searchParams],
  );
  const usesOwnLayout =
    pathname === "/" &&
    (AUTH_QUERY_ROUTES.has(queryRoutePath) || /^\/admin(?:\/|$)/.test(queryRoutePath));

  if (usesOwnLayout) return <>{children}</>;

  return <AppShell>{children}</AppShell>;
}
