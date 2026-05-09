import Link from "next/link";
import type { Event } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABEL, FORMAT_LABEL } from "./event-config";
import { formatTimeRange, relativeTime } from "@/lib/utils";
import { MapPin, Video, Calendar } from "lucide-react";

type CardEvent = Pick<
  Event,
  | "id"
  | "slug"
  | "title"
  | "category"
  | "format"
  | "startAt"
  | "endAt"
  | "city"
  | "capacity"
  | "visibility"
  | "status"
> & { _count?: { registrations: number } };

export function EventCard({ event }: { event: CardEvent }) {
  const past = event.endAt < new Date();
  const cancelled = event.status === "CANCELLED";

  return (
    <Link href={`/events/${event.slug}`} className="block group">
      <Card className="h-full transition-all group-hover:shadow-lift group-hover:-translate-y-0.5">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="pink">{CATEGORY_LABEL[event.category]}</Badge>
            <Badge variant="outline">{FORMAT_LABEL[event.format]}</Badge>
            {cancelled ? <Badge variant="danger">已取消</Badge> : null}
            {past && !cancelled ? <Badge variant="outline">已结束</Badge> : null}
          </div>
          <h3 className="font-serif text-h3 leading-tight tracking-tight line-clamp-2">
            {event.title}
          </h3>
          <div className="flex items-center gap-1.5 text-sm text-ink-muted">
            <Calendar className="h-3.5 w-3.5" strokeWidth={1.8} />
            <span>{formatTimeRange(event.startAt, event.endAt)}</span>
          </div>
          {event.format !== "ONLINE" && event.city ? (
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>{event.city}</span>
            </div>
          ) : null}
          {event.format === "ONLINE" ? (
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              <Video className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>线上活动</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between text-xs text-ink-subtle pt-2 border-t border-border">
            <span>
              已报名{" "}
              <strong className="text-ink">
                {event._count?.registrations ?? 0}
              </strong>
              {event.capacity ? ` / ${event.capacity}` : null}
            </span>
            <span>{relativeTime(event.startAt)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
