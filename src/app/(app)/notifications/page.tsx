"use client";
import * as React from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import { toQueryRoute } from "@/lib/query-routing";

type Notification = {
  id: string;
  kind: string;
  payload?: string | null;
  read_at?: string | null;
  created_at: string;
};

type Payload = Record<string, unknown>;

function parsePayload(raw?: string | null): Payload {
  if (!raw) return {};
  try { return JSON.parse(raw) as Payload; } catch { return {}; }
}

function notificationText(n: Notification): { title: string; href?: string } {
  const p = parsePayload(n.payload);

  function strField(...keys: string[]): string | undefined {
    for (const key of keys) {
      if (typeof p[key] === "string") return p[key] as string;
    }
    return undefined;
  }

  const eventTitle = strField("eventTitle", "title");
  const eventSlug = strField("eventSlug", "slug");
  const requesterHandle = strField("requesterHandle");
  const eventHref = eventSlug ? toQueryRoute(`/events/${eventSlug}`) : undefined;

  switch (n.kind) {
    case "CONTACT_REQ":
      return {
        title: requesterHandle ? `@${requesterHandle} 申请查看你的联系方式` : "你收到一条联系方式申请",
        href: toQueryRoute("/me/contact-requests"),
      };
    case "CONTACT_REQ_APPROVED":
      return { title: "你的联系方式申请已被同意", href: toQueryRoute("/me/contacts") };
    case "CONTACT_REQ_DECLINED":
      return { title: "你的联系方式申请未被通过" };
    case "REG_CONFIRMED":
      return { title: eventTitle ? `你已成功报名「${eventTitle}」` : "活动报名已确认", href: eventHref };
    case "REG_WAITLIST":
      return { title: eventTitle ? `你已加入「${eventTitle}」候补名单` : "活动报名已转为候补", href: eventHref };
    case "REG_DECLINED":
      return { title: eventTitle ? `「${eventTitle}」报名未通过` : "活动报名未通过", href: eventHref };
    case "REG_PENDING":
      return { title: eventTitle ? `「${eventTitle}」报名等待审核` : "活动报名等待审核", href: eventHref };
    case "EVENT_REMINDER":
      return { title: eventTitle ? `「${eventTitle}」即将开始` : "活动即将开始", href: eventHref };
    case "EVENT_CANCELLED":
      return { title: eventTitle ? `「${eventTitle}」已取消` : "活动已取消", href: eventHref };
    case "EVENT_RECOMMENDATION":
      return { title: eventTitle ? `有人向你推荐了「${eventTitle}」` : "有人向你推荐了一个活动", href: eventHref };
    case "APP_APPROVED":
      return { title: "你的入站申请已通过，欢迎加入！", href: toQueryRoute("/events") };
    case "POST_APPROVED": {
      const postId = strField("postId");
      const title = strField("title");
      return {
        title: title ? `「${title}」已发布` : "你的帖子已发布",
        href: postId ? toQueryRoute(`/posts/${postId}`) : toQueryRoute("/posts"),
      };
    }
    case "POST_PENDING_REVIEW": {
      const postId = strField("postId");
      const title = strField("title");
      const reason = strField("reason");
      return {
        title: title
          ? `「${title}」正在等待人工复核${reason ? ` — ${reason}` : ""}`
          : "你的帖子正在等待人工复核",
        href: postId ? toQueryRoute(`/posts/${postId}`) : toQueryRoute("/posts"),
      };
    }
    case "POST_REJECTED": {
      const postId = strField("postId");
      const title = strField("title");
      const reason = strField("reason");
      return {
        title: title
          ? `「${title}」未通过审核${reason ? ` — ${reason}` : ""}`
          : "你的帖子未通过审核",
        href: postId ? toQueryRoute(`/posts/${postId}`) : toQueryRoute("/posts"),
      };
    }
    case "XIAO_T_REPLIED": {
      const postId = strField("postId");
      const title = strField("title");
      return {
        title: title ? `小T 回复了「${title}」` : "小T 给你的帖子回复了",
        href: postId ? toQueryRoute(`/posts/${postId}`) : toQueryRoute("/posts"),
      };
    }
    case "EVENT_APPROVED":
      return { title: eventTitle ? `「${eventTitle}」已发布` : "活动已发布", href: eventHref };
    case "EVENT_PENDING_REVIEW":
      return {
        title: eventTitle ? `「${eventTitle}」等待复核` : "活动等待复核",
        href: eventHref,
      };
    case "EVENT_REJECTED": {
      const reason = strField("reason");
      return {
        title: eventTitle
          ? `「${eventTitle}」未通过审核${reason ? ` — ${reason}` : ""}`
          : "活动未通过审核",
        href: eventHref,
      };
    }
    default:
      return { title: n.kind };
  }
}

export default function NotificationsPage() {
  const [notifs, setNotifs] = React.useState<Notification[]>([]);
  const [showArchive, setShowArchive] = React.useState(false);

  React.useEffect(() => {
    api.notifications.list().then((res: { notifications: unknown[] }) => {
      setNotifs(res.notifications as Notification[]);
      const unread = (res.notifications as Notification[])
        .filter((n) => !n.read_at)
        .map((n) => n.id);
      if (unread.length > 0) {
        api.notifications.markRead(unread);
      }
    });
  }, []);

  const unread = notifs.filter((n) => !n.read_at);
  const archived = notifs.filter((n) => !!n.read_at);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="通知" />

      {notifs.length === 0 ? (
        <EmptyState title="还没有通知" />
      ) : (
        <>
          {unread.length === 0 && archived.length > 0 ? (
            <p className="text-sm text-ink-muted">所有通知均已读。</p>
          ) : null}

          {unread.length > 0 ? (
            <section className="space-y-2">
              <div className="text-xs uppercase tracking-wider text-ink-subtle">未读</div>
              <div className="space-y-2">
                {unread.map((n) => <NotifCard key={n.id} notif={n} />)}
              </div>
            </section>
          ) : null}

          {archived.length > 0 ? (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-wider text-ink-subtle">
                  归档 ({archived.length})
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6"
                  onClick={() => setShowArchive((v) => !v)}
                >
                  {showArchive ? "收起" : "展开"}
                </Button>
              </div>
              {showArchive ? (
                <div className="space-y-2">
                  {archived.map((n) => <NotifCard key={n.id} notif={n} muted />)}
                </div>
              ) : null}
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function NotifCard({ notif, muted }: { notif: Notification; muted?: boolean }) {
  const { title, href } = notificationText(notif);
  const content = (
    <Card className={muted ? "opacity-70" : undefined}>
      <CardContent className="py-4 flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className={`text-sm font-medium ${muted ? "text-ink-muted" : ""}`}>{title}</div>
          <div className="text-xs text-ink-subtle">{relativeTime(new Date(notif.created_at))}</div>
        </div>
        {!notif.read_at ? <Badge variant="pink" className="shrink-0 text-[10px] px-1.5 py-0.5">新</Badge> : null}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block hover:no-underline">{content}</Link>;
  }
  return content;
}
