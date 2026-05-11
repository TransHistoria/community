"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicEventsListPage = pathname === "/events";
  const isPublicEventDetailPage = /^\/events\/[^/]+$/.test(pathname);
  const isPublicUserProfilePage = /^\/u\/[^/]+$/.test(pathname);
  const isGuestAccessiblePage =
    isPublicEventsListPage ||
    isPublicEventDetailPage ||
    isPublicUserProfilePage;

  useEffect(() => {
    if (!loading && !user && !isGuestAccessiblePage) {
      router.replace("/sign-in");
    }
  }, [user, loading, router, isGuestAccessiblePage]);

  if (loading && !isGuestAccessiblePage) return null;
  if (!user && isGuestAccessiblePage) return <AppShell>{children}</AppShell>;
  if (!user) return null;
  return <AppShell>{children}</AppShell>;
}
