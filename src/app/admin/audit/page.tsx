"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

type Log = { id: string; action: string; target_type?: string; target_id?: string; created_at: string; actor_handle?: string };

export default function AdminAuditPage() {
  const [logs, setLogs] = React.useState<Log[]>([]);
  React.useEffect(() => {
    api.admin.auditLog().then(({ logs: ls }) => setLogs(ls as Log[]));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="管理后台" title="操作日志" description="所有管理员动作均有记录。" />
      <div className="space-y-2">
        {logs.map((l) => (
          <Card key={l.id}>
            <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{l.action}</Badge>
                {l.target_type ? <span className="text-ink-muted">{l.target_type}/<span className="font-mono text-xs">{l.target_id}</span></span> : null}
              </div>
              <div className="text-xs text-ink-subtle">
                {l.actor_handle ? `@${l.actor_handle} · ` : ""}{formatDateTime(new Date(l.created_at))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "操作日志" };

export default async function AdminAuditPage() {
  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      actor: { select: { handle: true, displayName: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="管理后台"
        title="操作日志"
        description="所有管理员动作均有记录，最近 200 条。"
      />
      <div className="space-y-2">
        {logs.map((l) => (
          <Card key={l.id}>
            <CardContent className="py-3 flex items-center justify-between gap-3 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{l.action}</Badge>
                <span className="text-ink-muted">
                  {l.targetType}/<span className="font-mono text-xs">{l.targetId}</span>
                </span>
              </div>
              <div className="text-xs text-ink-subtle">
                @{l.actor.handle} · {formatDateTime(l.createdAt)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
