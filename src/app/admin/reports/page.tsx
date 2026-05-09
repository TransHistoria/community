import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { ReportDecisionForm } from "./ReportDecisionForm";
import { formatDateTime } from "@/lib/utils";

export const metadata = { title: "举报队列" };

const TARGET_LABEL: Record<string, string> = {
  USER: "用户",
  EVENT: "活动",
  COMMENT: "评论",
};

export default async function AdminReportsPage() {
  const [open, history] = await Promise.all([
    db.report.findMany({
      where: { status: { in: ["OPEN", "INVESTIGATING"] } },
      include: { reporter: { select: { handle: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
    }),
    db.report.findMany({
      where: { status: { in: ["RESOLVED", "DISMISSED"] } },
      include: { reporter: { select: { handle: true } } },
      orderBy: { resolvedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="管理后台" title="举报队列" />
      <Tabs defaultValue="open" className="space-y-4">
        <TabsList>
          <TabsTrigger value="open">待处理 ({open.length})</TabsTrigger>
          <TabsTrigger value="history">历史</TabsTrigger>
        </TabsList>
        <TabsContent value="open" className="space-y-3">
          {open.length === 0 ? (
            <EmptyState title="没有待处理的举报" />
          ) : (
            open.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-5 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="text-sm">
                      <Badge variant="warn" className="mr-2">
                        {TARGET_LABEL[r.targetType]}
                      </Badge>
                      <Link
                        href={
                          r.targetType === "USER"
                            ? `/u/${r.targetId}` // ID redirect not supported; admin can copy
                            : r.targetType === "EVENT"
                              ? `/events`
                              : `/events`
                        }
                        className="font-mono text-xs text-trans-blue-deep hover:underline"
                      >
                        {r.targetId}
                      </Link>
                    </div>
                    <div className="text-xs text-ink-subtle">
                      举报人：@{r.reporter.handle} · {formatDateTime(r.createdAt)}
                    </div>
                  </div>
                  <p className="text-sm bg-bg-warm rounded-md p-3 border-l-2 border-rose-300">
                    {r.reason}
                  </p>
                  <ReportDecisionForm
                    reportId={r.id}
                    targetType={r.targetType as "USER" | "EVENT" | "COMMENT"}
                  />
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
        <TabsContent value="history" className="space-y-3">
          {history.length === 0 ? (
            <EmptyState title="还没有历史" />
          ) : (
            history.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-4 text-sm flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <Badge
                      variant={r.status === "RESOLVED" ? "success" : "outline"}
                      className="mr-2"
                    >
                      {r.status === "RESOLVED" ? "已处理" : "已驳回"}
                    </Badge>
                    {TARGET_LABEL[r.targetType]} · {r.targetId}
                  </div>
                  <span className="text-xs text-ink-subtle">
                    {formatDateTime(r.resolvedAt ?? r.createdAt)}
                  </span>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
