"use client";

import Link from "next/link";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/contexts/AuthContext";
import { toQueryRoute } from "@/lib/query-routing";

export function TopBar() {
  const user = useCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg-warm/85 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link
              href={toQueryRoute("/posts")}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              广场
            </Link>
            <Link
              href={toQueryRoute("/about")}
              className="text-ink-muted hover:text-ink transition-colors"
            >
              关于
            </Link>
            {user ? (
              <Link
                href={toQueryRoute("/notifications")}
                className="text-ink-muted hover:text-ink transition-colors"
              >
                通知
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <UserMenu user={user} />
          ) : (
            <>
              <Button variant="ghost" asChild className="hidden sm:inline-flex">
                <Link href={toQueryRoute("/sign-in")}>登录</Link>
              </Button>
              <Button asChild>
                <Link href={toQueryRoute("/sign-up")}>加入</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
