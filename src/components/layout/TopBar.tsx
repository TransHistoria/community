import Link from "next/link";
import { Logo } from "./Logo";
import { UserMenu } from "./UserMenu";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

export async function TopBar() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg-warm/85 backdrop-blur-md">
      <div className="container flex h-16 items-center justify-between gap-6">
        <div className="flex items-center gap-8">
          <Logo />
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link
              href="/events"
              className="text-ink-muted hover:text-ink transition-colors"
            >
              活动
            </Link>
            <Link
              href="/about"
              className="text-ink-muted hover:text-ink transition-colors"
            >
              关于
            </Link>
            {user ? (
              <Link
                href="/notifications"
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
                <Link href="/sign-in">登录</Link>
              </Button>
              <Button asChild>
                <Link href="/sign-up">加入</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
