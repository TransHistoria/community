"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isGuestAccessibleEventsList = pathname === "/events";

  useEffect(() => {
    if (!loading && !user && !isGuestAccessibleEventsList) {
      router.replace("/sign-in");
    }
  }, [user, loading, router, isGuestAccessibleEventsList]);

  if (loading && !isGuestAccessibleEventsList) return null;
  if (!user && isGuestAccessibleEventsList) return <>{children}</>;
  if (!user) return null;
  return <AppShell>{children}</AppShell>;
}
