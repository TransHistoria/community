import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { ApplicationDecisionForm } from "./ApplicationDecisionForm";
import { formatDateTime } from "@/lib/utils";
import { jsonDecode } from "@/lib/json";

export const metadata = { title: "申请审核" };

export default async function AdminApplicationsPage() {
  const [pending, history] = await Promise.all([
    db.application.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    }),
    db.application.findMany({
      where: { status: { in: ["APPROVED", "REJECTED"] } },
      orderBy: { reviewedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="管理后台"
        title="入站申请"
        description="审核新成员的入站申请。请仔细看 ta 的自我描述与来意。"
      />

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">待审核 ({pending.length})</TabsTrigger>
          <TabsTrigger value="history">历史</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {pending.length === 0 ? (
            <EmptyState title="没有待审核的申请" />
          ) : (
            pending.map((app) => (
              <Card key={app.id}>
                <CardContent className="pt-5 space-y-3">
                  <div className="text-sm">
                    <strong>{app.email}</strong>
                    <span className="text-ink-subtle"> · 提交于 {formatDateTime(app.createdAt)}</span>
                  </div>
                  <AnswersBlock
                    answers={jsonDecode<Record<string, string>>(app.answers)}
                  />
                  <ApplicationDecisionForm applicationId={app.id} />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {history.length === 0 ? (
            <EmptyState title="还没有历史记录" />
          ) : (
            history.map((app) => (
              <Card key={app.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                      <strong>{app.email}</strong>
                      <span className="text-ink-subtle">
                        {" "}· {formatDateTime(app.reviewedAt ?? app.createdAt)}
                      </span>
                    </div>
                    <Badge
                      variant={app.status === "APPROVED" ? "success" : "outline"}
                    >
                      {app.status === "APPROVED" ? "已通过" : "已拒绝"}
                    </Badge>
                  </div>
                  {app.reviewerNote ? (
                    <p className="text-xs text-ink-muted">{app.reviewerNote}</p>
                  ) : null}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AnswersBlock({ answers }: { answers: Record<string, string> | null }) {
  if (!answers) return null;
  return (
    <div className="space-y-2 text-sm bg-bg-warm rounded-md p-3 border-l-2 border-trans-blue">
      {answers.identity ? (
        <div>
          <div className="text-xs text-ink-subtle">自我认同</div>
          <div className="whitespace-pre-wrap">{answers.identity}</div>
        </div>
      ) : null}
      {answers.motivation ? (
        <div>
          <div className="text-xs text-ink-subtle">来意</div>
          <div className="whitespace-pre-wrap">{answers.motivation}</div>
        </div>
      ) : null}
      {answers.vouch ? (
        <div>
          <div className="text-xs text-ink-subtle">熟识成员</div>
          <div>{answers.vouch}</div>
        </div>
      ) : null}
    </div>
  );
}
