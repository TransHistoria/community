import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardContent } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";
import { jsonDecode } from "@/lib/json";

export const metadata = { title: "通知" };

const KIND_LABEL: Record<string, string> = {
  CONTACT_REQ: "你收到一条联系方式申请",
  CONTACT_REQ_APPROVED: "你的联系方式申请被同意",
  CONTACT_REQ_DECLINED: "你的联系方式申请被拒绝",
  REG_CONFIRMED: "活动报名已确认",
  REG_WAITLIST: "活动报名已转为候补",
  REG_DECLINED: "活动报名未通过",
  REG_PENDING: "活动报名等待审核",
  EVENT_REMINDER: "活动即将开始",
  EVENT_CANCELLED: "活动已取消",
  EVENT_RECOMMENDATION: "有人向你推荐了一个活动",
  APP_APPROVED: "你的入站申请已通过",
};

// Internal kinds (e.g. INVITE_PRECHECK) are not surfaced to users.
const HIDDEN_KINDS = ["INVITE_PRECHECK"];

export default async function NotificationsPage() {
  const viewer = await requireUser();
  const notifs = await db.notification.findMany({
    where: { userId: viewer.id, kind: { notIn: HIDDEN_KINDS } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (notifs.some((n) => !n.readAt)) {
    await db.notification.updateMany({
      where: {
        userId: viewer.id,
        readAt: null,
        kind: { notIn: HIDDEN_KINDS },
      },
      data: { readAt: new Date() },
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="通知" />
      {notifs.length === 0 ? (
        <EmptyState title="还没有通知" />
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => (
            <Card key={n.id}>
              <CardContent className="py-4 space-y-1">
                <div className="text-sm font-medium">
                  {KIND_LABEL[n.kind] ?? n.kind}
                </div>
                <div className="text-xs text-ink-muted">
                  {(() => {
                    const p = jsonDecode<Record<string, unknown>>(n.payload);
                    if (!p) return null;
                    return Object.entries(p)
                      .filter(([, v]) => typeof v === "string" || typeof v === "number")
                      .map(([k, v]) => `${k}: ${String(v)}`)
                      .join(" · ");
                  })()}
                </div>
                <div className="text-xs text-ink-subtle">
                  {relativeTime(n.createdAt)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
