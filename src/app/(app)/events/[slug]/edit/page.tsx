import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canEditEvent } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { EventForm } from "@/components/event/EventForm";
import { jsonDecode } from "@/lib/json";
import type {
  EventCategory,
  EventFormat,
  Visibility,
} from "@/lib/enums";

export const metadata = { title: "编辑活动" };

type Question = {
  id: string;
  prompt: string;
  required: boolean;
  type: "text" | "long-text" | "single-choice";
  options?: string[];
};

export default async function EditEventPage({
  params,
}: {
  params: { slug: string };
}) {
  const viewer = await requireUser();
  const event = await db.event.findUnique({ where: { slug: params.slug } });
  if (!event) notFound();
  if (!canEditEvent(viewer, event)) notFound();

  const visibility = event.visibility as Visibility;
  const formVisibility =
    visibility === "HIDDEN_REQUEST" ? "VERIFIED" : (visibility as "PUBLIC" | "VERIFIED" | "TRUSTED");

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
          coverUrl: event.coverUrl ?? "",
          startAt: event.startAt,
          endAt: event.endAt,
          city: event.city ?? "",
          preciseAddr: event.preciseAddr ?? "",
          onlineUrl: event.onlineUrl ?? "",
          capacity: event.capacity ? String(event.capacity) : "",
          requireApproval: event.requireApproval,
          registrationOpensAt: event.registrationOpensAt,
          registrationClosesAt: event.registrationClosesAt,
          visibility: formVisibility,
          customQuestions: jsonDecode<Question[]>(event.customQuestions) ?? [],
        }}
      />
    </div>
  );
}
