"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";

const GUEST_ACCESSIBLE_EVENT_DETAIL_PATTERN = /^\/events\/[^/]+$/;
const GUEST_ACCESSIBLE_USER_PROFILE_PATTERN = /^\/u\/[^/]+$/;

function isGuestAccessiblePath(pathname: string): boolean {
  return (
    pathname === "/events" ||
    GUEST_ACCESSIBLE_EVENT_DETAIL_PATTERN.test(pathname) ||
    GUEST_ACCESSIBLE_USER_PROFILE_PATTERN.test(pathname)
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isGuestAccessiblePage = isGuestAccessiblePath(pathname);

  useEffect(() => {
    if (!loading && !user && !isGuestAccessiblePage) {
      router.replace("/sign-in");
    }
  }, [user, loading, router, isGuestAccessiblePage]);

  if (!user) {
    if (loading || !isGuestAccessiblePage) return null;
  }

  return <AppShell>{children}</AppShell>;
}
