"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { CreateInviteForm } from "./CreateInviteForm";
import { CopyInviteButton } from "./CopyInviteButton";
import { canIssueInvites, inviteQuotaPerQuarter } from "@/lib/access";
import { formatDate } from "@/lib/utils";

type InviteCode = {
  code: string;
  note?: string | null;
  max_uses: number;
  used_count: number;
  expires_at?: string | null;
  created_at: string;
};

function quarterStart(d = new Date()) {
  const m = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), m, 1);
}

export default function MeInvitesPage() {
  const { user } = useAuth();
  const [codes, setCodes] = React.useState<InviteCode[]>([]);

  const loadCodes = React.useCallback(() => {
    api.users.myInvites().then(({ invites }) => setCodes(invites as InviteCode[]));
  }, []);

  React.useEffect(() => { loadCodes(); }, [loadCodes]);

  if (!user) return null;

  const quotaTotal = inviteQuotaPerQuarter(user.tier);
  const qStart = quarterStart();
  const usedThisQuarter = codes.filter(
    (c) => new Date(c.created_at) >= qStart,
  ).length;
  const remaining = Math.max(0, quotaTotal - usedThisQuarter);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        eyebrow="我的资料"
        title="我的邀请码"
        description="如果你认识社群外想加入的朋友，可以发一份邀请码。每个邀请码默认仅供一人使用。"
      />

      {!canIssueInvites(user) ? (
        <EmptyState
          title="还无法签发邀请码"
          description="完成认证后才能签发邀请码。如果你刚加入，先去参加一两个活动熟悉社群。"
        />
      ) : (
        <>
          <Card>
            <CardContent className="py-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">本季度配额</div>
                <div className="text-xs text-ink-muted">自然季（1/4/7/10 月）首日重置</div>
              </div>
              <Badge variant="blue">剩余 {remaining} / {quotaTotal}</Badge>
            </CardContent>
          </Card>

          {remaining > 0 ? <CreateInviteForm onCreated={loadCodes} /> : null}
        </>
      )}

      <section className="space-y-3">
        <h2 className="font-serif text-h3 tracking-tight">已签发的邀请码</h2>
        {codes.length === 0 ? (
          <EmptyState title="还没有签发过邀请码" />
        ) : (
          codes.map((c) => {
            const expired = c.expires_at && new Date(c.expires_at) < new Date();
            const used = c.used_count >= c.max_uses;
            return (
              <Card key={c.code}>
                <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="font-mono text-base tracking-widest">{c.code}</div>
                    <div className="text-xs text-ink-subtle space-x-2">
                      <span>签发于 {formatDate(new Date(c.created_at))}</span>
                      <span>·</span>
                      <span>使用 {c.used_count}/{c.max_uses}</span>
                      {c.expires_at ? (
                        <>
                          <span>·</span>
                          <span>到期 {formatDate(new Date(c.expires_at))}</span>
                        </>
                      ) : null}
                      {c.note ? (
                        <>
                          <span>·</span>
                          <span>{c.note}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {used ? (
                      <Badge variant="outline">已用完</Badge>
                    ) : expired ? (
                      <Badge variant="outline">已过期</Badge>
                    ) : (
                      <Badge variant="success">可用</Badge>
                    )}
                    {!used && !expired ? <CopyInviteButton code={c.code} /> : null}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
