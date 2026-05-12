"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { ReportDecisionForm } from "./ReportDecisionForm";
import { formatDateTime } from "@/lib/utils";

const TARGET_LABEL: Record<string, string> = { USER: "用户", EVENT: "活动", COMMENT: "评论" };

type Report = { id: string; status: string; target_type: string; target_id: string; reason: string; created_at: string; resolved_at?: string | null; reporter_handle?: string };

export default function AdminReportsPage() {
  const [reports, setReports] = React.useState<Report[]>([]);
  function load() {
    Promise.all([
      api.admin.listReports("OPEN"),
      api.admin.listReports("RESOLVED"),
      api.admin.listReports("DISMISSED"),
    ]).then(([a, b, c]) =>
      setReports([
        ...(a.reports as Report[]),
        ...(b.reports as Report[]),
        ...(c.reports as Report[]),
      ])
    );
  }
  React.useEffect(() => { load(); }, []);

  const open = reports.filter((r) => r.status === "OPEN" || r.status === "INVESTIGATING");
  const history = reports.filter((r) => r.status === "RESOLVED" || r.status === "DISMISSED");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="管理后台" title="举报队列" />
      <Tabs defaultValue="open" className="space-y-4">
        <TabsList>
          <TabsTrigger value="open">待处理 ({open.length})</TabsTrigger>
          <TabsTrigger value="history">历史</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="space-y-3">
          {open.length === 0 ? <EmptyState title="没有待处理的举报" /> : (
            open.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm">
                      <Badge variant="warn" className="mr-2">{TARGET_LABEL[r.target_type] ?? r.target_type}</Badge>
                      <span className="font-mono text-xs">{r.target_id}</span>
                    </div>
                    <div className="text-xs text-ink-subtle">
                      {r.reporter_handle ? `举报人：@${r.reporter_handle} · ` : ""}{formatDateTime(new Date(r.created_at))}
                    </div>
                  </div>
                  <p className="text-sm bg-bg-warm rounded-md p-3 border-l-2 border-rose-300">{r.reason}</p>
                  <ReportDecisionForm reportId={r.id} targetType={r.target_type as "USER" | "EVENT" | "COMMENT"} onDecided={load} />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          {history.length === 0 ? <EmptyState title="还没有历史" /> : (
            history.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-4 text-sm flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <Badge variant={r.status === "RESOLVED" ? "success" : "outline"} className="mr-2">
                      {r.status === "RESOLVED" ? "已处理" : "已驳回"}
                    </Badge>
                    {TARGET_LABEL[r.target_type]} · {r.target_id}
                  </div>
                  <span className="text-xs text-ink-subtle">{formatDateTime(new Date(r.resolved_at ?? r.created_at))}</span>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
