"use client";
import * as React from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { canEditEvent } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { EventForm } from "@/components/event/EventForm";
import type { EventCategory, EventFormat, Visibility } from "@/lib/enums";

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
  description: string;
  category: string;
  format: string;
  cover_url?: string | null;
  start_at: string;
  end_at: string;
  city?: string | null;
  precise_addr?: string | null;
  online_url?: string | null;
  capacity?: number | null;
  require_approval: boolean;
  registration_opens_at?: string | null;
  registration_closes_at?: string | null;
  visibility: string;
  custom_questions?: string | null;
  organizer_id: string;
};

export default function EditEventPageClient() {
  const { slug } = useParams<{ slug: string }>();
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

  if (!canEditEvent(user, { organizerId: event.organizer_id } as any)) {
    return <p className="text-ink-muted">无权访问。</p>;
  }

  const visibility = event.visibility as Visibility;
  const formVisibility =
    visibility === "HIDDEN_REQUEST"
      ? "VERIFIED"
      : (visibility as "PUBLIC" | "VERIFIED" | "TRUSTED");

  let questions: Question[] = [];
  if (event.custom_questions) {
    try {
      questions = JSON.parse(event.custom_questions) as Question[];
    } catch {
      questions = [];
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader eyebrow={event.title} title="编辑活动" />
      <EventForm
        mode="edit"
        eventId={event.id}
        initial={{
          title: event.title,
          description: event.description,
          category: event.category as EventCategory,
          format: event.format as EventFormat,
          coverUrl: event.cover_url ?? "",
          startAt: event.start_at,
          endAt: event.end_at,
          city: event.city ?? "",
          preciseAddr: event.precise_addr ?? "",
          onlineUrl: event.online_url ?? "",
          capacity: event.capacity ? String(event.capacity) : "",
          requireApproval: event.require_approval,
          registrationOpensAt: event.registration_opens_at ?? null,
          registrationClosesAt: event.registration_closes_at ?? null,
          visibility: formVisibility,
          customQuestions: questions,
        }}
      />
    </div>
  );
}
