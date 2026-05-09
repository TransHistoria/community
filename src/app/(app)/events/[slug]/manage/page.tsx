import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canEditEvent } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { RegistrationActions } from "./RegistrationActions";
import { CancelEventButton } from "./CancelEventButton";
import { formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { jsonDecode } from "@/lib/json";
import type { RegStatus } from "@/lib/enums";

export const metadata = { title: "管理活动" };

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待审核",
  CONFIRMED: "已确认",
  WAITLIST: "候补",
  DECLINED: "未通过",
  CANCELLED: "已取消",
  CHECKED_IN: "已签到",
  NO_SHOW: "未到场",
};

export default async function ManageEventPage({
  params,
}: {
  params: { slug: string };
}) {
  const viewer = await requireUser();
  const event = await db.event.findUnique({ where: { slug: params.slug } });
  if (!event) notFound();
  if (!canEditEvent(viewer, event)) notFound();

  const regs = await db.registration.findMany({
    where: { eventId: event.id },
    include: {
      user: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
          tier: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = {
    PENDING: regs.filter((r) => r.status === "PENDING"),
    CONFIRMED: regs.filter((r) => r.status === "CONFIRMED" || r.status === "CHECKED_IN"),
    WAITLIST: regs.filter((r) => r.status === "WAITLIST"),
    OTHER: regs.filter((r) =>
      ["DECLINED", "CANCELLED", "NO_SHOW"].includes(r.status),
    ),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={event.title}
        title="活动管理"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/events/${event.slug}`}>查看活动</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/events/${event.slug}/edit`}>编辑</Link>
            </Button>
            {event.status !== "CANCELLED" ? (
              <CancelEventButton eventId={event.id} />
            ) : null}
          </div>
        }
      />

      <Tabs defaultValue="confirmed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">
            待审核 ({groups.PENDING.length})
          </TabsTrigger>
          <TabsTrigger value="confirmed">
            已确认 ({groups.CONFIRMED.length})
          </TabsTrigger>
          <TabsTrigger value="waitlist">
            候补 ({groups.WAITLIST.length})
          </TabsTrigger>
          <TabsTrigger value="other">其他 ({groups.OTHER.length})</TabsTrigger>
        </TabsList>

        {(["pending", "confirmed", "waitlist", "other"] as const).map((k) => {
          const list = groups[k.toUpperCase() as keyof typeof groups];
          return (
            <TabsContent key={k} value={k} className="space-y-3">
              {list.length === 0 ? (
                <EmptyState title="暂无记录" />
              ) : (
                list.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <Link
                          href={`/u/${r.user.handle}`}
                          className="flex items-center gap-3 group"
                        >
                          <Avatar>
                            {r.user.avatarUrl ? (
                              <AvatarImage src={r.user.avatarUrl} alt="" />
                            ) : null}
                            <AvatarFallback>
                              {r.user.displayName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium group-hover:text-trans-blue-deep">
                              {r.user.displayName}
                            </div>
                            <div className="text-xs text-ink-subtle">
                              @{r.user.handle} · {formatDateTime(r.createdAt)}
                            </div>
                          </div>
                        </Link>
                        <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
                      </div>
                      {(() => {
                        const ans = jsonDecode<Record<string, string>>(r.answers);
                        if (!ans || Object.keys(ans).length === 0) return null;
                        return (
                          <div className="text-xs text-ink-muted bg-bg-warm rounded-md p-3 space-y-1">
                            {Object.entries(ans).map(([k, v]) => (
                              <div key={k}>
                                <strong>{k}:</strong> {v}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <RegistrationActions
                        registrationId={r.id}
                        currentStatus={r.status as RegStatus}
                      />
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
