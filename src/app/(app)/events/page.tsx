"use client";
import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { api } from "@/lib/api";
import type { Event } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canCreateEvent } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/event/EventCard";
import { EmptyState } from "@/components/ui/empty";
import { ALL_CATEGORIES, CATEGORY_LABEL, FORMAT_LABEL } from "@/components/event/event-config";
import type { EventCategory } from "@/lib/enums";
import { Plus } from "lucide-react";
import { toQueryRoute } from "@/lib/query-routing";

const ALL_FORMATS = ["ONLINE", "OFFLINE", "HYBRID"] as const;

function EventsPageInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [events, setEvents] = React.useState<Event[]>([]);
  const [loadFailed, setLoadFailed] = React.useState(false);

  const cat = searchParams.get("category") ?? undefined;
  const fmt = searchParams.get("format") ?? undefined;
  const city = searchParams.get("city") ?? undefined;
  const q = searchParams.get("q") ?? undefined;

  React.useEffect(() => {
    api.events
      .list({ category: cat, format: fmt, city, q })
      .then((res: { events: Event[] }) => {
        setEvents(res.events);
        setLoadFailed(false);
      })
      .catch(() => {
        setEvents([]);
        setLoadFailed(true);
      });
  }, [cat, fmt, city, q]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="活动"
        title="社群里的活动"
        description="按分类与形式浏览。线下活动的精确地点在报名通过后可见。"
        actions={
          canCreateEvent(user) ? (
              <Button asChild>
              <Link href={toQueryRoute("/events/new")}>
                <Plus className="h-4 w-4" /> 创建活动
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <FilterPill href={toQueryRoute(fmt ? `/events?format=${fmt}` : "/events")} active={!cat}>全部分类</FilterPill>
          {ALL_CATEGORIES.map((c) => (
            <FilterPill
              key={c}
              href={toQueryRoute(`/events?category=${c}${fmt ? `&format=${fmt}` : ""}`)}
              active={cat === c}
            >
              {CATEGORY_LABEL[c as EventCategory]}
            </FilterPill>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterPill href={toQueryRoute(cat ? `/events?category=${cat}` : "/events")} active={!fmt}>全部形式</FilterPill>
          {ALL_FORMATS.map((f) => (
            <FilterPill
              key={f}
              href={toQueryRoute(`/events?format=${f}${cat ? `&category=${cat}` : ""}`)}
              active={fmt === f}
            >
              {FORMAT_LABEL[f]}
            </FilterPill>
          ))}
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="当前没有可显示的活动"
          description={
            loadFailed
              ? "活动加载失败，请检查网络连接或广告拦截插件设置后重试。"
              : canCreateEvent(user)
              ? "你也可以是第一个组织活动的人。"
              : "完成认证后可以参加活动；信任成员还能发布。"
          }
          action={
            canCreateEvent(user) ? (
              <Button asChild>
                <Link href={toQueryRoute("/events/new")}>创建一个活动</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EventsPage() {
  return (
    <Suspense>
      <EventsPageInner />
    </Suspense>
  );
}

function FilterPill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        "rounded-full px-3 py-1.5 text-xs transition-colors " +
        (active
          ? "bg-trans-gradient text-white shadow-soft"
          : "border border-border bg-card text-ink-muted hover:text-ink")
      }
    >
      {children}
    </Link>
  );
}
