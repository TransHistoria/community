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
  const [pendingReqs, setPendingReqs] = React.useState(0);
  const [unreadNotif, setUnreadNotif] = React.useState(0);

  React.useEffect(() => {
    if (!user) return;
    api.users.myRegistrations().then(({ registrations }) => {
      const now = new Date();
      const up = registrations.filter(
        (r: Registration) =>
          ["CONFIRMED", "WAITLIST", "PENDING"].includes(r.status) &&
          r.start_at &&
          new Date(r.start_at) >= now,
      );
      up.sort(
        (a: Registration, b: Registration) =>
          new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
      );
      setUpcoming(up.slice(0, 5));
    });
    api.users.myContactRequests().then(({ requests }) => {
      const pending = requests.filter(
        (r: { target_id: string; status: string }) =>
          r.target_id === user.id && r.status === "PENDING",
      );
      setPendingReqs(pending.length);
    });
    api.notifications.list(true).then(({ notifications }) => {
      setUnreadNotif(notifications.length);
    });
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
          href={`/u/${user.handle}`}
        />
        <StatCard
          label="待处理联系请求"
          value={pendingReqs}
          hint="来自其他成员对你联系方式的查看申请"
          href="/me/contact-requests"
        />
        <StatCard
          label="未读通知"
          value={unreadNotif}
          hint="活动状态、请求回复等"
          href="/notifications"
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between">
          <h2 className="font-serif text-h2 tracking-tight">即将到来的活动</h2>
          <Link href="/me/registrations" className="text-sm text-trans-blue-deep hover:underline">
            查看全部
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-ink-muted">
              暂时没有即将到来的活动。
              <Button asChild variant="link" className="ml-1">
                <Link href="/events">浏览活动</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {upcoming.map((r) => (
              <Card key={r.id}>
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div className="space-y-1">
                    <div className="font-medium">
                      <Link href={`/events/${r.slug}`} className="hover:text-trans-blue-deep">
                        {r.title}
                      </Link>
                    </div>
                    <div className="text-xs text-ink-muted flex items-center gap-2 flex-wrap">
                      <span>{formatTimeRange(new Date(r.start_at), r.end_at ? new Date(r.end_at) : null)}</span>
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
                  <Badge
                    variant={
                      r.status === "CONFIRMED" ? "success" : r.status === "WAITLIST" ? "warn" : "outline"
                    }
                  >
                    {r.status === "CONFIRMED" ? "已确认" : r.status === "WAITLIST" ? "候补" : "待审核"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
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
