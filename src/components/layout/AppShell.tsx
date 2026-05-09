import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { Footer } from "./Footer";
import { getCurrentUser } from "@/lib/session";

export async function AppShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
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
