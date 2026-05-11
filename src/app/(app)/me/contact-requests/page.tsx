"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { CONTACT_KIND_LABEL } from "@/components/user/contact-config";
import { formatDateTime } from "@/lib/utils";
import { DecisionButtons } from "./DecisionButtons";

type ContactRequest = {
  id: string;
  requester_id: string;
  target_id: string;
  status: string;
  reason: string;
  created_at: string;
  contact_id?: string | null;
  requester_handle?: string;
  requester_name?: string;
  target_handle?: string;
  target_name?: string;
  contact_kind?: string;
  contact_label?: string | null;
};

export default function ContactRequestsPage() {
  const { user } = useAuth();
  const [requests, setRequests] = React.useState<ContactRequest[]>([]);

  const load = React.useCallback(() => {
    api.users.myContactRequests().then(({ requests: reqs }) =>
      setRequests(reqs as ContactRequest[]),
    );
  }, []);

  React.useEffect(() => { load(); }, [load]);

  if (!user) return null;

  const received = requests.filter((r) => r.target_id === user.id);
  const sent = requests.filter((r) => r.requester_id === user.id);

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
                      <span className="font-medium">{r.requester_name}</span>
                      <span className="text-ink-subtle"> @{r.requester_handle}</span>
                      <span className="text-ink-muted">
                        {" "}申请查看{" "}
                        <strong>
                          {r.contact_label ??
                            (r.contact_kind ? CONTACT_KIND_LABEL[r.contact_kind] : "全部隐藏项")}
                        </strong>
                      </span>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-sm bg-bg-warm rounded-md p-3 border-l-2 border-trans-blue">
                    {r.reason}
                  </p>
                  <div className="flex items-center justify-between text-xs text-ink-subtle">
                    <span>{formatDateTime(new Date(r.created_at))}</span>
                    {r.status === "PENDING" ? (
                      <DecisionButtons requestId={r.id} onDecided={load} />
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
                      <strong>{r.target_name}</strong>{" "}
                      <span className="text-ink-subtle">@{r.target_handle}</span>
                      {" "}的{" "}
                      <strong>
                        {r.contact_label ??
                          (r.contact_kind ? CONTACT_KIND_LABEL[r.contact_kind] : "全部隐藏项")}
                      </strong>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="text-xs text-ink-subtle">{formatDateTime(new Date(r.created_at))}</p>
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

