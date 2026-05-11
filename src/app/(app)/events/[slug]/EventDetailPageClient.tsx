"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canViewEvent, canViewEventDetails, canEditEvent, canRegister } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommentSection } from "./CommentSection";
import { CancelMyRegistrationButton } from "./CancelMyRegistrationButton";
import { CATEGORY_LABEL, EVENT_VISIBILITY_LABEL, FORMAT_LABEL } from "@/components/event/event-config";
import { formatTimeRange } from "@/lib/utils";

type ApiEvent = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  format: string;
  visibility: string;
  status: string;
  city?: string | null;
  precise_addr?: string | null;
  online_url?: string | null;
  start_at: string;
  end_at: string;
  capacity?: number | null;
  organizer_id: string;
  reg_count?: number;
  registration?: { id: string; status: string } | null;
};

function regStatusLabel(s: string) {
  return ({ PENDING: "待审核", CONFIRMED: "已确认", WAITLIST: "候补", DECLINED: "未通过", CANCELLED: "已取消", CHECKED_IN: "已签到", NO_SHOW: "未到场" } as Record<string, string>)[s] ?? s;
}

export default function EventDetailPageClient() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [event, setEvent] = React.useState<ApiEvent | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!slug) return;
    api.events.get(slug).then((res: { event: unknown }) => setEvent(res.event as ApiEvent)).catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) return <p className="text-ink-muted">活动不存在。</p>;
  if (!event) return null;

  const viewer = user ? { ...user, tier: user.tier as string } : null;
  const accessEvent = {
    ...event,
    startAt: new Date(event.start_at),
    endAt: new Date(event.end_at),
    organizerId: event.organizer_id,
    preciseAddr: event.precise_addr,
    onlineUrl: event.online_url,
  };

  if (!canViewEvent(viewer, accessEvent as any)) return <p className="text-ink-muted">你没有权限查看此活动。</p>;

  const myReg = event.registration ?? null;
  const fullDetailsVisible = canViewEventDetails(viewer, accessEvent as any, myReg);
  const canManage = canEditEvent(viewer, accessEvent);
  const canRegisterRes = canRegister(viewer, accessEvent as any);

  return (
    <article className="max-w-3xl mx-auto space-y-8">
      <PageHeader eyebrow={CATEGORY_LABEL[event.category as keyof typeof CATEGORY_LABEL]} title={event.title} />
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="blue">{FORMAT_LABEL[event.format as keyof typeof FORMAT_LABEL]}</Badge>
        <Badge variant="outline">{EVENT_VISIBILITY_LABEL[event.visibility as keyof typeof EVENT_VISIBILITY_LABEL]}</Badge>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2 text-sm">
          <p>{formatTimeRange(new Date(event.start_at), new Date(event.end_at))}</p>
          {event.city ? <p>城市：{event.city}</p> : null}
          {fullDetailsVisible && event.precise_addr ? <p>地址：{event.precise_addr}</p> : null}
          {fullDetailsVisible && event.online_url ? <p>链接：{event.online_url}</p> : null}
          <p>已报名 {event.reg_count ?? 0}{event.capacity ? ` / ${event.capacity}` : ""}</p>
          {canManage ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/events/${event.slug}/manage`}>管理活动</Link>
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-serif text-h2 tracking-tight">活动介绍</h2>
        <Card>
          <CardContent className="pt-6">
            <p className="whitespace-pre-wrap">{event.description}</p>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-h2 tracking-tight">报名</h2>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {myReg && myReg.status !== "CANCELLED" && myReg.status !== "DECLINED" ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm">你的状态：{regStatusLabel(myReg.status)}</div>
                <CancelMyRegistrationButton registrationId={myReg.id} />
              </div>
            ) : canRegisterRes.ok ? (
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={`/events/${event.slug}/register`}>报名</Link>
              </Button>
            ) : (
              <p className="text-sm text-ink-muted">{canRegisterRes.reason}</p>
            )}
          </CardContent>
        </Card>
      </section>

      {user ? <CommentSection eventId={event.id} /> : null}
    </article>
  );
}
