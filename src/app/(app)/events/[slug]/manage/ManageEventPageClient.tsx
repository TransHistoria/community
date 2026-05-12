"use client";
import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
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
import { toQueryRoute } from "@/lib/query-routing";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "待审核",
  CONFIRMED: "已确认",
  WAITLIST: "候补",
  DECLINED: "未通过",
  CANCELLED: "已取消",
  CHECKED_IN: "已签到",
  NO_SHOW: "未到场",
};

type ApiEvent = {
  id: string;
  slug: string;
  title: string;
  status: string;
  organizer_id: string;
  start_at?: string;
  end_at?: string;
};

type ApiReg = {
  id: string;
  status: string;
  created_at: string;
  answers?: string | null;
  user_handle?: string;
  user_name?: string;
  user_avatar?: string | null;
  user_email?: string;
};

export default function ManageEventPageClient() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [event, setEvent] = React.useState<ApiEvent | null>(null);
  const [regs, setRegs] = React.useState<ApiReg[]>([]);

  function loadData() {
    if (!slug) return;
    api.events.get(slug).then((res: { event: unknown }) => {
      const ev = res.event as ApiEvent;
      setEvent(ev);
      api.events.listRegistrations(ev.id).then((regsRes: { registrations: unknown[] }) => {
        setRegs(regsRes.registrations as ApiReg[]);
      });
    });
  }

  React.useEffect(() => {
    loadData();
  }, [slug]);

  if (!event) return null;
  if (!canEditEvent(user, { organizerId: event.organizer_id } as any)) {
    return <p className="text-ink-muted">无权访问。</p>;
  }

  const groups = {
    PENDING: regs.filter((r) => r.status === "PENDING"),
    CONFIRMED: regs.filter((r) => r.status === "CONFIRMED" || r.status === "CHECKED_IN"),
    WAITLIST: regs.filter((r) => r.status === "WAITLIST"),
    OTHER: regs.filter((r) => ["DECLINED", "CANCELLED", "NO_SHOW"].includes(r.status)),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={event.title}
        title="活动管理"
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={toQueryRoute(`/events/${event.slug}`)}>查看活动</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={toQueryRoute(`/events/${event.slug}/edit`)}>编辑</Link>
            </Button>
            {event.status !== "CANCELLED" ? (
              <CancelEventButton eventId={event.id} onCancelled={loadData} />
            ) : null}
          </div>
        }
      />

      <Tabs defaultValue="confirmed" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending">待审核 ({groups.PENDING.length})</TabsTrigger>
          <TabsTrigger value="confirmed">已确认 ({groups.CONFIRMED.length})</TabsTrigger>
          <TabsTrigger value="waitlist">候补 ({groups.WAITLIST.length})</TabsTrigger>
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
                        <Link href={`/u/${r.user_handle}`} className="flex items-center gap-3 group">
                          <Avatar>
                            {r.user_avatar ? <AvatarImage src={r.user_avatar} alt="" /> : null}
                            <AvatarFallback>{r.user_name?.charAt(0) ?? "?"}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium group-hover:text-trans-blue-deep">{r.user_name}</div>
                            <div className="text-xs text-ink-subtle">
                              @{r.user_handle} · {formatDateTime(new Date(r.created_at))}
                            </div>
                          </div>
                        </Link>
                        <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
                      </div>
                      {(() => {
                        if (!r.answers) return null;
                        try {
                          const ans = JSON.parse(r.answers) as Record<string, string>;
                          if (!ans || Object.keys(ans).length === 0) return null;
                          return (
                            <div className="text-xs text-ink-muted bg-bg-warm rounded-md p-3 space-y-1">
                              {Object.entries(ans).map(([key, v]) => (
                                <div key={key}>
                                  <strong>{key}:</strong> {v}
                                </div>
                              ))}
                            </div>
                          );
                        } catch {
                          return null;
                        }
                      })()}
                      <RegistrationActions
                        registrationId={r.id}
                        currentStatus={r.status}
                        onUpdated={loadData}
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
