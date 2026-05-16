"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calendar, Home, User, Bell, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toQueryRoute } from "@/lib/query-routing";

export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  if (!signedIn) return null;

  const items = [
    { href: toQueryRoute("/events"), label: "活动", icon: Calendar, match: /^\/events/ },
    { href: toQueryRoute("/posts"), label: "广场", icon: Sparkles, match: /^\/posts/ },
    { href: toQueryRoute("/me"), label: "我", icon: Home, match: /^\/me$/ },
    { href: toQueryRoute("/notifications"), label: "通知", icon: Bell, match: /^\/notifications/ },
    { href: toQueryRoute("/me/profile"), label: "主页", icon: User, match: /^\/me\/profile/ },
  ];

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg-warm/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      <ul className="grid grid-cols-5 min-w-0">
        {items.map((it) => {
          const active = it.match.test(pathname ?? "");
          const Icon = it.icon;
          return (
            <li key={it.href} className="min-w-0">
              <Link
                href={it.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition-colors min-w-0",
                  active ? "text-trans-blue-deep" : "text-ink-muted",
                )}
              >
                <Icon className="h-5 w-5 flex-none" strokeWidth={active ? 2.4 : 1.8} />
                <span className="truncate max-w-full">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
