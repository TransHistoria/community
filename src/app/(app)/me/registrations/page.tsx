"use client";
import * as React from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { formatTimeRange } from "@/lib/utils";

type Registration = {
  id: string;
  status: string;
  slug: string;
  title: string;
  start_at: string;
  end_at?: string | null;
};

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warn" | "outline" | "danger" }> = {
  PENDING: { label: "待审核", variant: "warn" },
  CONFIRMED: { label: "已确认", variant: "success" },
  WAITLIST: { label: "候补", variant: "warn" },
  DECLINED: { label: "未通过", variant: "outline" },
  CANCELLED: { label: "已取消", variant: "outline" },
  CHECKED_IN: { label: "已签到", variant: "success" },
  NO_SHOW: { label: "未到场", variant: "danger" },
};

export default function MeRegistrationsPage() {
  const [regs, setRegs] = React.useState<Registration[]>([]);

  React.useEffect(() => {
    api.users.myRegistrations().then(({ registrations }) => {
      const sorted = [...registrations].sort(
        (a: Registration, b: Registration) =>
          new Date(b.start_at).getTime() - new Date(a.start_at).getTime(),
      );
      setRegs(sorted);
    });
  }, []);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader eyebrow="我的资料" title="我的报名" description="历史与即将到来的报名记录。" />
      {regs.length === 0 ? (
        <EmptyState title="还没有报名过任何活动" />
      ) : (
        <div className="space-y-3">
          {regs.map((r) => {
            const s = STATUS_LABEL[r.status] ?? { label: r.status, variant: "outline" as const };
            return (
              <Card key={r.id}>
                <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <Link href={`/events/${r.slug}`} className="text-sm font-medium hover:text-trans-blue-deep">
                      {r.title}
                    </Link>
                    <div className="text-xs text-ink-muted">
                      {formatTimeRange(new Date(r.start_at), r.end_at ? new Date(r.end_at) : null)}
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
