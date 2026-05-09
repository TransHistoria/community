import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import {
  canViewEvent,
  canViewEventDetails,
  canEditEvent,
  canRegister,
} from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TierBadge } from "@/components/user/TierBadge";
import { ProfileMarkdown } from "@/components/user/ProfileMarkdown";
import {
  CATEGORY_LABEL,
  EVENT_VISIBILITY_LABEL,
  FORMAT_LABEL,
} from "@/components/event/event-config";
import { formatTimeRange } from "@/lib/utils";
import { Calendar, MapPin, Users, Lock, Video, Settings, Flag } from "lucide-react";
import { ReportButton } from "@/components/moderation/ReportButton";
import { ShareEventButton } from "@/components/event/ShareEventButton";
import type { Visibility } from "@/lib/enums";
import { CommentSection } from "./CommentSection";
import { CancelMyRegistrationButton } from "./CancelMyRegistrationButton";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const e = await db.event.findUnique({
    where: { slug: params.slug },
    select: { title: true },
  });
  return { title: e?.title ?? "活动" };
}

export default async function EventDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const viewer = await getCurrentUser();
  const event = await db.event.findUnique({
    where: { slug: params.slug },
    include: {
      organizer: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
          tier: true,
        },
      },
      _count: {
        select: { registrations: true },
      },
    },
  });
  if (!event) notFound();
  if (!canViewEvent(viewer, event)) notFound();

  const myReg = viewer
    ? await db.registration.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: viewer.id } },
      })
    : null;

  const fullDetailsVisible = canViewEventDetails(viewer, event, myReg);
  const canManage = canEditEvent(viewer, event);
  const canRegisterRes = canRegister(viewer, event);

  const confirmedCount = await db.registration.count({
    where: {
      eventId: event.id,
      status: { in: ["CONFIRMED", "CHECKED_IN"] },
    },
  });

  return (
    <article className="max-w-3xl mx-auto space-y-8">
      <PageHeader
        eyebrow={CATEGORY_LABEL[event.category]}
        title={event.title}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {viewer ? (
              <ShareEventButton
                eventId={event.id}
                slug={event.slug}
                title={event.title}
                visibility={event.visibility as Visibility}
              />
            ) : null}
            {canManage ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/events/${event.slug}/manage`}>
                  <Settings className="h-4 w-4" />
                  管理
                </Link>
              </Button>
            ) : viewer ? (
              <ReportButton targetType="EVENT" targetId={event.id}>
                <Flag className="h-3.5 w-3.5" />
                举报
              </ReportButton>
            ) : null}
          </div>
        }
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="blue">{FORMAT_LABEL[event.format]}</Badge>
        <Badge variant="outline">{EVENT_VISIBILITY_LABEL[event.visibility]}</Badge>
        {event.status === "CANCELLED" ? (
          <Badge variant="danger">已取消</Badge>
        ) : null}
      </div>

      <Card>
        <CardContent className="pt-6 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-trans-blue-deep" />
            <span>{formatTimeRange(event.startAt, event.endAt)}</span>
          </div>
          {event.format !== "ONLINE" ? (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-trans-blue-deep mt-0.5" />
              <div>
                <div>{event.city || "城市未填"}</div>
                {fullDetailsVisible && event.preciseAddr ? (
                  <div className="text-ink-muted text-xs mt-0.5">
                    {event.preciseAddr}
                  </div>
                ) : event.preciseAddr ? (
                  <div className="text-ink-subtle text-xs mt-0.5 inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    精确地址在报名通过后可见
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {event.format !== "OFFLINE" ? (
            <div className="flex items-start gap-2">
              <Video className="h-4 w-4 text-trans-blue-deep mt-0.5" />
              <div>
                {fullDetailsVisible && event.onlineUrl ? (
                  <a
                    href={event.onlineUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-trans-blue-deep hover:underline break-all"
                  >
                    {event.onlineUrl}
                  </a>
                ) : (
                  <span className="text-ink-subtle text-xs inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    会议链接在报名通过后可见
                  </span>
                )}
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-trans-blue-deep" />
            <span>
              已报名 <strong>{confirmedCount}</strong>
              {event.capacity ? ` / ${event.capacity}` : null}
            </span>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="font-serif text-h2 tracking-tight">活动介绍</h2>
        <Card>
          <CardContent className="pt-6">
            <ProfileMarkdown source={event.description} />
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-serif text-h2 tracking-tight">组织者</h2>
        <Card>
          <CardContent className="py-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar>
                {event.organizer.avatarUrl ? (
                  <AvatarImage src={event.organizer.avatarUrl} alt="" />
                ) : null}
                <AvatarFallback>
                  {event.organizer.displayName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <Link
                  href={`/u/${event.organizer.handle}`}
                  className="font-medium hover:text-trans-blue-deep"
                >
                  {event.organizer.displayName}
                </Link>
                <div className="text-xs text-ink-subtle flex items-center gap-2">
                  <span>@{event.organizer.handle}</span>
                  <TierBadge tier={event.organizer.tier} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Registration block */}
      <section className="space-y-3">
        <h2 className="font-serif text-h2 tracking-tight">报名</h2>
        <Card>
          <CardContent className="pt-6 space-y-3">
            {event.status !== "PUBLISHED" ? (
              <p className="text-sm text-ink-muted">
                {event.status === "CANCELLED"
                  ? "活动已取消。"
                  : "活动暂未开放报名。"}
              </p>
            ) : myReg && myReg.status !== "CANCELLED" && myReg.status !== "DECLINED" ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  你的状态：
                  <Badge
                    variant={
                      myReg.status === "CONFIRMED" || myReg.status === "CHECKED_IN"
                        ? "success"
                        : myReg.status === "WAITLIST"
                          ? "warn"
                          : "outline"
                    }
                    className="ml-2"
                  >
                    {regStatusLabel(myReg.status)}
                  </Badge>
                </div>
                <CancelMyRegistrationButton eventId={event.id} />
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

      {viewer ? <CommentSection eventId={event.id} /> : null}
    </article>
  );
}

function regStatusLabel(s: string) {
  return (
    {
      PENDING: "待审核",
      CONFIRMED: "已确认",
      WAITLIST: "候补",
      DECLINED: "未通过",
      CANCELLED: "已取消",
      CHECKED_IN: "已签到",
      NO_SHOW: "未到场",
    } as Record<string, string>
  )[s] ?? s;
}
