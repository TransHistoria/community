import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { CONTACT_KIND_LABEL } from "@/components/user/contact-config";
import { formatDateTime } from "@/lib/utils";
import { DecisionButtons } from "./DecisionButtons";

export const metadata = { title: "联系请求" };

export default async function ContactRequestsPage() {
  const viewer = await requireUser();

  const [received, sent] = await Promise.all([
    db.contactRequest.findMany({
      where: { targetId: viewer.id },
      include: {
        requester: { select: { handle: true, displayName: true, avatarUrl: true } },
        contact: { select: { id: true, kind: true, label: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.contactRequest.findMany({
      where: { requesterId: viewer.id },
      include: {
        target: { select: { handle: true, displayName: true } },
        contact: { select: { id: true, kind: true, label: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        eyebrow="我的资料"
        title="联系请求"
        description="管理他人想查看你联系方式的请求，以及你向其他人发出的请求。"
      />

      <Tabs defaultValue="received" className="space-y-4">
        <TabsList>
          <TabsTrigger value="received">
            收到的（{received.filter((r) => r.status === "PENDING").length} 待处理）
          </TabsTrigger>
          <TabsTrigger value="sent">我发出的</TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="space-y-3">
          {received.length === 0 ? (
            <EmptyState title="没有收到过联系请求" />
          ) : (
            received.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                      <span className="font-medium">{r.requester.displayName}</span>
                      <span className="text-ink-subtle"> @{r.requester.handle}</span>
                      <span className="text-ink-muted">
                        {" "}申请查看{" "}
                        <strong>
                          {r.contact?.label ??
                            (r.contact ? CONTACT_KIND_LABEL[r.contact.kind] : "全部隐藏项")}
                        </strong>
                      </span>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-sm bg-bg-warm rounded-md p-3 border-l-2 border-trans-blue">
                    {r.reason}
                  </p>
                  <div className="flex items-center justify-between text-xs text-ink-subtle">
                    <span>{formatDateTime(r.createdAt)}</span>
                    {r.status === "PENDING" ? (
                      <DecisionButtons requestId={r.id} />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="sent" className="space-y-3">
          {sent.length === 0 ? (
            <EmptyState title="还没有发出过联系请求" />
          ) : (
            sent.map((r) => (
              <Card key={r.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="text-sm">
                      申请{" "}
                      <strong>{r.target.displayName}</strong>{" "}
                      <span className="text-ink-subtle">@{r.target.handle}</span>
                      {" "}的{" "}
                      <strong>
                        {r.contact?.label ??
                          (r.contact ? CONTACT_KIND_LABEL[r.contact.kind] : "全部隐藏项")}
                      </strong>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-ink-subtle">
                    {formatDateTime(r.createdAt)}
                  </p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "PENDING") return <Badge variant="warn">待处理</Badge>;
  if (status === "APPROVED") return <Badge variant="success">已同意</Badge>;
  return <Badge variant="outline">已拒绝</Badge>;
}
