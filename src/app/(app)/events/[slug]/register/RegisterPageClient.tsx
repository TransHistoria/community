"use client";
import * as React from "react";
import { useParams, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canRegister, canViewEvent } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getQueryRoute } from "@/lib/query-routing";
import { RegistrationForm } from "./RegistrationForm";
import { formatTimeRange } from "@/lib/utils";

type Question = {
  id: string;
  prompt: string;
  required: boolean;
  type: "text" | "long-text" | "single-choice";
  options?: string[];
};

type ApiEvent = {
  id: string;
  slug: string;
  title: string;
  start_at: string;
  end_at: string;
  require_approval: boolean;
  custom_questions?: string | null;
  organizer_id: string;
  status: string;
  registration?: { id: string; status: string } | null;
};

export default function RegisterPageClient() {
  const params = useParams<{ slug?: string }>();
  const searchParams = useSearchParams();
  const queryRoute = React.useMemo(() => getQueryRoute(searchParams), [searchParams]);
  const queryRouteSlug = queryRoute.path.match(/^\/events\/([^/]+)\/register$/)?.[1] ?? "";
  const isLiteralEventsRoute = queryRoute.path === "/events/register" || queryRoute.path.startsWith("/events/");
  const routeParams = isLiteralEventsRoute ? queryRoute.params : searchParams;
  const slug = params.slug ?? queryRouteSlug ?? routeParams.get("slug") ?? "";
  const { user } = useAuth();
  const [event, setEvent] = React.useState<ApiEvent | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!slug) return;
    api.events
      .get(slug)
      .then((res: { event: unknown }) => setEvent(res.event as ApiEvent))
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) return <p className="text-ink-muted">活动不存在。</p>;
  if (!event) return null;

  const eventForAccess = {
    ...event,
    startAt: new Date(event.start_at),
    endAt: new Date(event.end_at),
    organizerId: event.organizer_id,
    requireApproval: event.require_approval,
  };

  if (!canViewEvent(user, eventForAccess as any)) return <p className="text-ink-muted">活动不存在。</p>;

  const myReg = event.registration;
  if (myReg && myReg.status !== "CANCELLED" && myReg.status !== "DECLINED") {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <PageHeader title="报名" />
        <Card>
          <CardContent className="pt-6 text-sm text-ink-muted">你已经报名了这个活动。</CardContent>
        </Card>
      </div>
    );
  }

  const allowed = canRegister(user, eventForAccess as any);
  if (!allowed.ok) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <PageHeader title="无法报名" />
        <Card>
          <CardContent className="pt-6 text-sm text-ink-muted">{allowed.reason}</CardContent>
        </Card>
      </div>
    );
  }

  let questions: Question[] = [];
  if (event.custom_questions) {
    try {
      questions = JSON.parse(event.custom_questions) as Question[];
    } catch {
      questions = [];
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        eyebrow={event.title}
        title="报名"
        description={`${formatTimeRange(new Date(event.start_at), new Date(event.end_at))}${event.require_approval ? " · 报名需组织者审核" : ""}`}
      />
      <RegistrationForm eventId={event.id} slug={event.slug} questions={questions} />
    </div>
  );
}
