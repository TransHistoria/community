"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardContent } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";

type Notification = {
  id: string;
  kind: string;
  payload?: string | null;
  read_at?: string | null;
  created_at: string;
};

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

export default function NotificationsPage() {
  const [notifs, setNotifs] = React.useState<Notification[]>([]);

  React.useEffect(() => {
    api.notifications.list().then((res: { notifications: unknown[] }) => {
      setNotifs(res.notifications as Notification[]);
      const unread = (res.notifications as Notification[])
        .filter((n) => !n.read_at)
        .map((n) => n.id);
      if (unread.length > 0) {
        api.notifications.markRead(unread);
      }
    });
  }, []);

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
                    if (!n.payload) return null;
                    try {
                      const p = JSON.parse(n.payload) as Record<string, unknown>;
                      return Object.entries(p)
                        .filter(([, v]) => typeof v === "string" || typeof v === "number")
                        .map(([k, v]) => `${k}: ${String(v)}`)
                        .join(" · ");
                    } catch {
                      return null;
                    }
                  })()}
                </div>
                <div className="text-xs text-ink-subtle">
                  {relativeTime(new Date(n.created_at))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
