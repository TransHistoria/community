"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";

const PUBLIC_EVENT_DETAIL_PATH = /^\/events\/[^/]+$/;
const PUBLIC_USER_PROFILE_PATH = /^\/u\/[^/]+$/;

function isGuestAccessiblePath(pathname: string): boolean {
  return (
    pathname === "/events" ||
    PUBLIC_EVENT_DETAIL_PATH.test(pathname) ||
    PUBLIC_USER_PROFILE_PATH.test(pathname)
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
    if (loading && !isGuestAccessiblePage) return null;
    if (!isGuestAccessiblePage) return null;
  }

  return <AppShell>{children}</AppShell>;
}
