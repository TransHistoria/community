"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ApplicationDecisionForm } from "./ApplicationDecisionForm";
import { formatDateTime } from "@/lib/utils";

type App = { id: string; email: string; status: string; created_at: string; reviewed_at?: string | null; reviewer_note?: string | null; answers?: string | null };

export default function AdminApplicationsPage() {
  const [apps, setApps] = React.useState<App[]>([]);

  function load() {
    Promise.all([
      api.applications.list("PENDING"),
      api.applications.list("APPROVED"),
      api.applications.list("REJECTED"),
    ]).then(([a, b, c]) =>
      setApps([
        ...(a.applications as App[]),
        ...(b.applications as App[]),
        ...(c.applications as App[]),
      ])
    );
  }
  React.useEffect(() => { load(); }, []);

  const pending = apps.filter((a) => a.status === "PENDING");
  const history = apps.filter((a) => a.status !== "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="管理后台" title="入站申请" description="审核新成员的入站申请。" />
      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">待审核 ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">历史</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="space-y-3">
          {pending.length === 0 ? <EmptyState title="没有待审核的申请" /> : (
            pending.map((app) => (
              <Card key={app.id}>
                <CardContent className="pt-5 space-y-3">
                  <div className="text-sm">
                    <strong>{app.email}</strong>
                    <span className="text-ink-subtle"> · 提交于 {formatDateTime(new Date(app.created_at))}</span>
                  </div>
                  <AnswersBlock answers={app.answers} />
                  <ApplicationDecisionForm applicationId={app.id} onDecided={load} />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          {history.length === 0 ? <EmptyState title="还没有历史记录" /> : (
            history.map((app) => (
              <Card key={app.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                      <strong>{app.email}</strong>
                      <span className="text-ink-subtle"> · {formatDateTime(new Date(app.reviewed_at ?? app.created_at))}</span>
                    </div>
                    <Badge variant={app.status === "APPROVED" ? "success" : "outline"}>
                      {app.status === "APPROVED" ? "已通过" : "已拒绝"}
                    </Badge>
                  </div>
                  {app.reviewer_note ? <p className="text-xs text-ink-muted">{app.reviewer_note}</p> : null}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnswersBlock({ answers }: { answers?: string | null }) {
  if (!answers) return null;
  let parsed: Record<string, string>;
  try { parsed = JSON.parse(answers) as Record<string, string>; } catch { return null; }
  return (
    <div className="space-y-2 text-sm bg-bg-warm rounded-md p-3 border-l-2 border-trans-blue">
      {parsed.identity ? <div><div className="text-xs text-ink-subtle">自我认同</div><div className="whitespace-pre-wrap">{parsed.identity}</div></div> : null}
      {parsed.motivation ? <div><div className="text-xs text-ink-subtle">来意</div><div className="whitespace-pre-wrap">{parsed.motivation}</div></div> : null}
      {parsed.vouch ? <div><div className="text-xs text-ink-subtle">熟识成员</div><div>{parsed.vouch}</div></div> : null}
    </div>
  );
}
