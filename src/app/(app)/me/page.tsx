import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatTimeRange, relativeTime } from "@/lib/utils";
import { TierBadge } from "@/components/user/TierBadge";

export const metadata = { title: "我的概览" };

export default async function MeOverviewPage() {
  const viewer = await requireUser();

  const [user, upcoming, pendingReqs, unreadNotif] = await Promise.all([
    db.user.findUnique({ where: { id: viewer.id } }),
    db.registration.findMany({
      where: {
        userId: viewer.id,
        status: { in: ["CONFIRMED", "WAITLIST", "PENDING"] },
        event: { startAt: { gte: new Date() }, status: "PUBLISHED" },
      },
      include: { event: { select: { id: true, slug: true, title: true, startAt: true, endAt: true, format: true, city: true } } },
      orderBy: { event: { startAt: "asc" } },
      take: 5,
    }),
    db.contactRequest.count({
      where: { targetId: viewer.id, status: "PENDING" },
    }),
    db.notification.count({
      where: { userId: viewer.id, readAt: null, kind: { not: "INVITE_PRECHECK" } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="我的概览"
        title={`你好，${user?.displayName ?? "朋友"}`}
        description="这里集中展示你即将参加的活动、待处理的请求和最新的通知。"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          label="我的身份"
          value={<TierBadge tier={user!.tier} />}
          hint={`@${user!.handle}`}
          href={`/u/${user!.handle}`}
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
          <Link
            href="/me/registrations"
            className="text-sm text-trans-blue-deep hover:underline"
          >
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
                      <Link
                        href={`/events/${r.event.slug}`}
                        className="hover:text-trans-blue-deep"
                      >
                        {r.event.title}
                      </Link>
                    </div>
                    <div className="text-xs text-ink-muted flex items-center gap-2 flex-wrap">
                      <span>{formatTimeRange(r.event.startAt, r.event.endAt)}</span>
                      <span>·</span>
                      <span>{relativeTime(r.event.startAt)}</span>
                      {r.event.format === "OFFLINE" && r.event.city ? (
                        <>
                          <span>·</span>
                          <span>{r.event.city}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <Badge
                    variant={
                      r.status === "CONFIRMED"
                        ? "success"
                        : r.status === "WAITLIST"
                          ? "warn"
                          : "outline"
                    }
                  >
                    {r.status === "CONFIRMED"
                      ? "已确认"
                      : r.status === "WAITLIST"
                        ? "候补"
                        : "待审核"}
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
          <div className="text-xs uppercase tracking-wider text-ink-subtle">
            {label}
          </div>
          <CardTitle className="text-h2 mt-1 flex items-center gap-2">
            {value}
          </CardTitle>
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
