"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

type Log = { id: string; action: string; target_type?: string; target_id?: string; created_at: string; actor_handle?: string };

const PAGE_SIZE = 10;

export default function AdminAuditPage() {
  const [logs, setLogs] = React.useState<Log[]>([]);
  const [showAll, setShowAll] = React.useState(false);

  React.useEffect(() => {
    api.admin.auditLog().then((res: { logs: unknown[] }) => setLogs(res.logs as Log[]));
  }, []);

  const visible = showAll ? logs : logs.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="管理后台" title="操作日志" description="所有管理员动作均有记录。" />
      <div className="space-y-2">
        {visible.map((l) => (
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
      {logs.length > PAGE_SIZE ? (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? `收起（仅显示最近 ${PAGE_SIZE} 条）` : `显示全部 ${logs.length} 条`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
