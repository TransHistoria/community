import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canViewContact, canViewProfile } from "@/lib/access";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TierBadge } from "@/components/user/TierBadge";
import {
  CONTACT_KIND_LABEL,
  VISIBILITY_SHORT,
} from "@/components/user/contact-config";
import { formatDate } from "@/lib/utils";
import { Lock, Flag } from "lucide-react";
import { ContactRequestButton } from "./ContactRequestButton";
import { BlockButton } from "./BlockButton";
import { ReportButton } from "@/components/moderation/ReportButton";
import { ProfileMarkdown } from "@/components/user/ProfileMarkdown";

export async function generateMetadata({ params }: { params: { handle: string } }) {
  return { title: `@${params.handle}` };
}

export default async function UserProfilePage({
  params,
}: {
  params: { handle: string };
}) {
  const viewer = await getCurrentUser();
  const target = await db.user.findUnique({
    where: { handle: params.handle.toLowerCase() },
    include: {
      contacts: { orderBy: { order: "asc" } },
      _count: { select: { events: true, registrations: true } },
    },
  });
  if (!target) notFound();
  if (!canViewProfile(viewer, target)) notFound();

  const isSelf = viewer?.id === target.id;

  // Approved contact-request grants
  const approvedContactIds = viewer
    ? (
        await db.contactRequest.findMany({
          where: {
            requesterId: viewer.id,
            targetId: target.id,
            status: "APPROVED",
          },
          select: { contactId: true },
        })
      ).map((r) => r.contactId)
    : [];

  const blockedByTarget = viewer
    ? !!(await db.block.findUnique({
        where: {
          blockerId_blockedId: { blockerId: target.id, blockedId: viewer.id },
        },
      }))
    : false;
  if (blockedByTarget && !isSelf) notFound();

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="flex flex-col sm:flex-row gap-6 sm:items-start">
        <Avatar className="h-24 w-24 ring-2 ring-border">
          {target.avatarUrl ? (
            <AvatarImage src={target.avatarUrl} alt={target.displayName} />
          ) : null}
          <AvatarFallback className="text-2xl">
            {target.displayName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-serif text-h1 tracking-tight">
                {target.displayName}
              </h1>
              <TierBadge tier={target.tier} />
            </div>
            <div className="flex items-center gap-3 text-sm text-ink-muted">
              <span>@{target.handle}</span>
              {target.pronouns ? <span>· {target.pronouns}</span> : null}
              {target.genderIdentity ? (
                <span>· {target.genderIdentity}</span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-ink-subtle">
            <span>组织过 {target._count.events} 场活动</span>
            <span>·</span>
            <span>参加过 {target._count.registrations} 次</span>
            <span>·</span>
            <span>加入于 {formatDate(target.createdAt)}</span>
          </div>
          {!isSelf && viewer ? (
            <div className="flex flex-wrap gap-2 pt-2">
              <ReportButton targetType="USER" targetId={target.id}>
                <Flag className="h-3.5 w-3.5" />
                举报
              </ReportButton>
              <BlockButton targetUserId={target.id} targetHandle={target.handle} />
            </div>
          ) : null}
          {isSelf ? (
            <Button asChild size="sm" variant="outline">
              <Link href="/me/profile">编辑主页</Link>
            </Button>
          ) : null}
        </div>
      </header>

      {target.bio ? (
        <Card>
          <CardContent className="pt-6">
            <ProfileMarkdown source={target.bio} />
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-serif text-h2 tracking-tight">联系方式</h2>
        {target.contacts.length === 0 ? (
          <p className="text-sm text-ink-muted">{isSelf ? "你还没有添加任何联系方式。" : "ta 暂时没有公开任何联系方式。"}</p>
        ) : (
          <ul className="space-y-2">
            {target.contacts.map((c) => {
              const approved = approvedContactIds.includes(c.id);
              const visible = canViewContact(viewer, target.id, c, approved);
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
                >
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">
                      {c.label ?? CONTACT_KIND_LABEL[c.kind]}
                      <span className="ml-2 text-xs text-ink-subtle font-normal">
                        {CONTACT_KIND_LABEL[c.kind]}
                      </span>
                    </div>
                    <div className="text-sm">
                      {visible ? (
                        <span className="font-mono text-ink">{c.value}</span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-ink-muted">
                          <Lock className="h-3.5 w-3.5" />
                          {c.visibility === "HIDDEN_REQUEST"
                            ? "已隐藏，需申请查看"
                            : `${VISIBILITY_SHORT[c.visibility]}才可见`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {VISIBILITY_SHORT[c.visibility]}
                    </Badge>
                    {!visible && c.visibility === "HIDDEN_REQUEST" && !isSelf && viewer ? (
                      <ContactRequestButton
                        targetHandle={target.handle}
                        contactId={c.id}
                        contactLabel={c.label ?? CONTACT_KIND_LABEL[c.kind]}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
