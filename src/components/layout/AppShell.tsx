"use client";

import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { Footer } from "./Footer";
import { useCurrentUser } from "@/contexts/AuthContext";

export function AppShell({ children }: { children: ReactNode }) {
  const user = useCurrentUser();
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="flex-1 pb-20 md:pb-0">
        <div className="container py-8 md:py-10">{children}</div>
      </main>
      <Footer />
      <MobileNav signedIn={!!user} />
    </div>
  );
}
