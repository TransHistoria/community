"use client";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { toQueryRoute } from "@/lib/query-routing";

const TIER_LABEL: Record<string, string> = {
  GUEST: "游客",
  UNVERIFIED: "未认证",
  VERIFIED: "已认证",
  TRUSTED: "信任成员",
  ADMIN: "管理员",
};

export function UserMenu({
  user,
}: {
  user: {
    handle: string;
    displayName: string;
    avatarUrl?: string | null;
    tier: string;
  };
}) {
  const { logout } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-full ring-offset-bg-warm focus:outline-none focus-visible:ring-2 focus-visible:ring-trans-blue focus-visible:ring-offset-2">
        <Avatar className="h-9 w-9 ring-1 ring-border">
          {user.avatarUrl ? (
            <AvatarImage src={user.avatarUrl} alt={user.displayName} />
          ) : null}
          <AvatarFallback>{user.displayName.charAt(0)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1 normal-case tracking-normal">
            <span className="text-sm font-medium text-ink">
              {user.displayName}
            </span>
            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <span>@{user.handle}</span>
              <Badge variant="blue" className="text-[10px]">
                {TIER_LABEL[user.tier] ?? user.tier}
              </Badge>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-ink-subtle">
          我的看板
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={toQueryRoute("/me")}>我的概览</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={toQueryRoute("/me/drafts")}>草稿箱</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={toQueryRoute("/me/bookmarks")}>我的收藏</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={toQueryRoute("/me/registrations")}>我的活动</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={toQueryRoute("/me/contact-requests")}>联系请求</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-ink-subtle">
          我的主页
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={toQueryRoute(`/u/${user.handle}`)}>查看我的主页</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={toQueryRoute("/me/profile")}>编辑主页与联系方式</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-ink-subtle">
          我的设置
        </DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link href={toQueryRoute("/me/invites")}>我的邀请码</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href={toQueryRoute("/me/settings")}>设置</Link>
        </DropdownMenuItem>
        {user.tier === "ADMIN" ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={toQueryRoute("/admin/applications")}>管理后台</Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive"
          onSelect={(e) => {
            e.preventDefault();
            logout();
          }}
        >
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
