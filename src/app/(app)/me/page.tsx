"use client";
import * as React from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTimeRange, relativeTime } from "@/lib/utils";
import { TierBadge } from "@/components/user/TierBadge";
import { toQueryRoute } from "@/lib/query-routing";

type Registration = {
  id: string;
  status: string;
  slug: string;
  title: string;
  start_at: string;
  end_at?: string | null;
  format: string;
  city?: string | null;
};

export default function MeOverviewPage() {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = React.useState<Registration[]>([]);
  const [allRegs, setAllRegs] = React.useState<Registration[]>([]);
  const [pendingReqs, setPendingReqs] = React.useState(0);
  const [unreadNotif, setUnreadNotif] = React.useState(0);
  const [draftCount, setDraftCount] = React.useState(0);
  const [bookmarkCount, setBookmarkCount] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    api.users.myRegistrations().then((res: { registrations: unknown[] }) => {
      const all = res.registrations as Registration[];
      const now = new Date();

      const up = all
        .filter(
          (r) =>
            ["CONFIRMED", "WAITLIST", "PENDING"].includes(r.status) &&
            r.start_at &&
            new Date(r.start_at) >= now,
        )
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
      setUpcoming(up.slice(0, 5));

      const sorted = all.sort(
        (a, b) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime(),
      );
      setAllRegs(sorted.slice(0, 5));
    });
    api.users.myContactRequests().then((res: { requests: unknown[] }) => {
      const pending = (res.requests as { target_id: string; status: string }[]).filter(
        (r: { target_id: string; status: string }) =>
          r.target_id === user.id && r.status === "PENDING",
      );
      setPendingReqs(pending.length);
    });
    api.notifications.list(true).then((res: { notifications: unknown[] }) => {
      setUnreadNotif(res.notifications.length);
    });
    api.posts.myDrafts().then((res) => setDraftCount(res.posts.length)).catch(() => setDraftCount(0));
    api.posts.myBookmarks().then((res) => setBookmarkCount(res.posts.length)).catch(() => setBookmarkCount(0));
  }, [user]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="我的概览"
        title={`你好，${user.displayName}`}
        description="这里集中展示你即将参加的活动、待处理的请求和最新的通知。"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="我的身份"
          value={<TierBadge tier={user.tier} />}
          hint={`@${user.handle}`}
          href={toQueryRoute(`/u/${user.handle}`)}
        />
        <StatCard
          label="待处理联系请求"
          value={pendingReqs}
          hint="来自其他成员对你联系方式的查看申请"
          href={toQueryRoute("/me/contact-requests")}
        />
        <StatCard
          label="草稿箱"
          value={draftCount}
          hint="继续编辑并发布你的草稿"
          href={toQueryRoute("/me/drafts")}
        />
        <StatCard
          label="我的收藏"
          value={bookmarkCount}
          hint="你收藏过的帖子"
          href={toQueryRoute("/me/bookmarks")}
        />
        <StatCard
          label="未读通知"
          value={unreadNotif}
          hint="活动状态、请求回复等"
          href={toQueryRoute("/notifications")}
        />
      </div>

      <section className="space-y-3">
        <h2 className="font-serif text-h2 tracking-tight">个人编辑与管理</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="编辑主页与联系方式"
            value="进入"
            hint="个人资料、联系方式统一管理"
            href={toQueryRoute("/me/profile")}
          />
          <StatCard
            label="我的活动"
            value={allRegs.length}
            hint="查看全部报名状态"
            href={toQueryRoute("/me/registrations")}
          />
          <StatCard
            label="联系请求"
            value={pendingReqs}
            hint="处理他人的查看申请"
            href={toQueryRoute("/me/contact-requests")}
          />
          <StatCard
            label="邀请码与设置"
            value="进入"
            hint="邀请码与账号设置"
            href={toQueryRoute("/me/invites")}
          />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-h2 tracking-tight">即将到来的活动</h2>
          <Link href={toQueryRoute("/me/registrations")} className="text-sm text-trans-blue-deep hover:underline">
            查看全部
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-muted">
              暂时没有即将到来的活动。
              <Button asChild variant="link" className="ml-1">
                <Link href={toQueryRoute("/events")}>浏览活动</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((r) => (
              <RegistrationRow key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-h2 tracking-tight">我的活动报名</h2>
          <Link href={toQueryRoute("/me/registrations")} className="text-sm text-trans-blue-deep hover:underline">
            查看全部
          </Link>
        </div>
        {allRegs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-muted">
              还没有报名过活动。
              <Button asChild variant="link" className="ml-1">
                <Link href={toQueryRoute("/events")}>浏览活动</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {allRegs.map((r) => (
              <RegistrationRow key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warn" | "outline" | "danger" }> = {
  PENDING: { label: "待审核", variant: "warn" },
  CONFIRMED: { label: "已确认", variant: "success" },
  WAITLIST: { label: "候补", variant: "warn" },
  DECLINED: { label: "未通过", variant: "outline" },
  CANCELLED: { label: "已取消", variant: "outline" },
  CHECKED_IN: { label: "已签到", variant: "success" },
  NO_SHOW: { label: "未到场", variant: "danger" },
};

function RegistrationRow({ r }: { r: Registration }) {
  const s = STATUS_LABEL[r.status] ?? { label: r.status, variant: "outline" as const };
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div className="space-y-1">
          <div className="font-medium">
            <Link href={toQueryRoute(`/events/${r.slug}`)} className="hover:text-trans-blue-deep">
              {r.title}
            </Link>
          </div>
          <div className="text-xs text-ink-muted flex items-center gap-2 flex-wrap">
            <span>{formatTimeRange(new Date(r.start_at), r.end_at ? new Date(r.end_at) : new Date(r.start_at))}</span>
            <span>·</span>
            <span>{relativeTime(new Date(r.start_at))}</span>
            {r.format === "OFFLINE" && r.city ? (
              <>
                <span>·</span>
                <span>{r.city}</span>
              </>
            ) : null}
          </div>
        </div>
        <Badge variant={s.variant}>{s.label}</Badge>
      </CardContent>
    </Card>
  );
}

function StatCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  href: string;
}) {
  return (
    <Link href={href} className="block group">
      <Card className="transition-shadow group-hover:shadow-soft">
        <CardHeader className="pb-3">
          <div className="text-xs uppercase tracking-wider text-ink-subtle">{label}</div>
          <CardTitle className="text-h2 mt-1 flex items-center gap-2">{value}</CardTitle>
        </CardHeader>
        {hint ? (
          <CardContent className="pt-0">
            <div className="text-sm text-ink-muted">{hint}</div>
          </CardContent>
        ) : null}
      </Card>
    </Link>
  );
}
