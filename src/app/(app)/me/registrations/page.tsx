import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatTimeRange } from "@/lib/utils";

export const metadata = { title: "我的报名" };

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warn" | "outline" | "danger" }> = {
  PENDING: { label: "待审核", variant: "warn" },
  CONFIRMED: { label: "已确认", variant: "success" },
  WAITLIST: { label: "候补", variant: "warn" },
  DECLINED: { label: "未通过", variant: "outline" },
  CANCELLED: { label: "已取消", variant: "outline" },
  CHECKED_IN: { label: "已签到", variant: "success" },
  NO_SHOW: { label: "未到场", variant: "danger" },
};

export default async function MeRegistrationsPage() {
  const viewer = await requireUser();
  const regs = await db.registration.findMany({
    where: { userId: viewer.id },
    include: { event: { select: { slug: true, title: true, startAt: true, endAt: true, status: true } } },
    orderBy: { event: { startAt: "desc" } },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        eyebrow="我的资料"
        title="我的报名"
        description="历史与即将到来的报名记录。"
      />
      {regs.length === 0 ? (
        <EmptyState title="还没有报名过任何活动" />
      ) : (
        <div className="space-y-3">
          {regs.map((r) => {
            const s = STATUS_LABEL[r.status];
            return (
              <Card key={r.id}>
                <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <Link
                      href={`/events/${r.event.slug}`}
                      className="text-sm font-medium hover:text-trans-blue-deep"
                    >
                      {r.event.title}
                    </Link>
                    <div className="text-xs text-ink-muted">
                      {formatTimeRange(r.event.startAt, r.event.endAt)}
                    </div>
                  </div>
                  <Badge variant={s.variant}>{s.label}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
