import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
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
