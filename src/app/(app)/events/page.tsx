import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { visibleEventsWhere } from "@/lib/access/queries";
import { canCreateEvent } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EventCard } from "@/components/event/EventCard";
import { EmptyState } from "@/components/ui/empty";
import { ALL_CATEGORIES, CATEGORY_LABEL } from "@/components/event/event-config";
import type { EventCategory, EventFormat } from "@/lib/enums";
import { Plus } from "lucide-react";

export const metadata = { title: "活动" };

export default async function EventsPage({
  searchParams,
}: {
  searchParams: { category?: string; format?: string; city?: string; q?: string };
}) {
  const viewer = await getCurrentUser();

  const cat = ALL_CATEGORIES.includes(searchParams.category as EventCategory)
    ? (searchParams.category as EventCategory)
    : undefined;
  const fmt = (["ONLINE", "OFFLINE", "HYBRID"] as EventFormat[]).includes(
    searchParams.format as EventFormat,
  )
    ? (searchParams.format as EventFormat)
    : undefined;

  const baseWhere = visibleEventsWhere(viewer);

  const events = await db.event.findMany({
    where: {
      ...baseWhere,
      ...(cat ? { category: cat } : {}),
      ...(fmt ? { format: fmt } : {}),
      ...(searchParams.city
        ? { city: { contains: searchParams.city } }
        : {}),
      ...(searchParams.q
        ? {
            OR: [
              { title: { contains: searchParams.q } },
              { description: { contains: searchParams.q } },
            ],
          }
        : {}),
      endAt: { gte: new Date() },
      status: "PUBLISHED",
    },
    include: { _count: { select: { registrations: true } } },
    orderBy: { startAt: "asc" },
    take: 60,
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="活动"
        title="社群里的活动"
        description="按分类与形式浏览。线下活动的精确地点在报名通过后可见。"
        actions={
          canCreateEvent(viewer) ? (
            <Button asChild>
              <Link href="/events/new">
                <Plus className="h-4 w-4" /> 创建活动
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        <FilterPill href="/events" active={!cat}>
          全部
        </FilterPill>
        {ALL_CATEGORIES.map((c) => (
          <FilterPill
            key={c}
            href={`/events?category=${c}`}
            active={cat === c}
          >
            {CATEGORY_LABEL[c]}
          </FilterPill>
        ))}
      </div>

      {events.length === 0 ? (
        <EmptyState
          title="当前没有可显示的活动"
          description={
            canCreateEvent(viewer)
              ? "你也可以是第一个组织活动的人。"
              : "完成认证后可以参加活动；信任成员还能发布。"
          }
          action={
            canCreateEvent(viewer) ? (
              <Button asChild>
                <Link href="/events/new">创建一个活动</Link>
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

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
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
