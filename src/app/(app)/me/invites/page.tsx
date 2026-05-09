import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { CreateInviteForm } from "./CreateInviteForm";
import { CopyInviteButton } from "./CopyInviteButton";
import { canIssueInvites, inviteQuotaPerQuarter } from "@/lib/access";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "我的邀请码" };

function quarterStart(d = new Date()) {
  const m = Math.floor(d.getMonth() / 3) * 3;
  return new Date(d.getFullYear(), m, 1);
}

export default async function MeInvitesPage() {
  const viewer = await requireUser();

  const quotaTotal = inviteQuotaPerQuarter(viewer.tier);
  const usedThisQuarter = await db.inviteCode.count({
    where: { issuerId: viewer.id, createdAt: { gte: quarterStart() } },
  });
  const remaining = Math.max(0, quotaTotal - usedThisQuarter);

  const codes = await db.inviteCode.findMany({
    where: { issuerId: viewer.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        eyebrow="我的资料"
        title="我的邀请码"
        description="如果你认识社群外想加入的朋友，可以发一份邀请码。每个邀请码默认仅供一人使用。"
      />

      {!canIssueInvites(viewer) ? (
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
                <div className="text-xs text-ink-muted">
                  自然季（1/4/7/10 月）首日重置
                </div>
              </div>
              <Badge variant="blue">
                剩余 {remaining} / {quotaTotal}
              </Badge>
            </CardContent>
          </Card>

          {remaining > 0 ? <CreateInviteForm /> : null}
        </>
      )}

      <section className="space-y-3">
        <h2 className="font-serif text-h3 tracking-tight">已签发的邀请码</h2>
        {codes.length === 0 ? (
          <EmptyState title="还没有签发过邀请码" />
        ) : (
          codes.map((c) => {
            const expired = c.expiresAt && c.expiresAt < new Date();
            const used = c.usedCount >= c.maxUses;
            return (
              <Card key={c.code}>
                <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="font-mono text-base tracking-widest">{c.code}</div>
                    <div className="text-xs text-ink-subtle space-x-2">
                      <span>签发于 {formatDate(c.createdAt)}</span>
                      <span>·</span>
                      <span>
                        使用 {c.usedCount}/{c.maxUses}
                      </span>
                      {c.expiresAt ? (
                        <>
                          <span>·</span>
                          <span>到期 {formatDate(c.expiresAt)}</span>
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
