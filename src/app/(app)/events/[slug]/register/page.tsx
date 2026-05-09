import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canRegister, canViewEvent } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { RegistrationForm } from "./RegistrationForm";
import { formatTimeRange } from "@/lib/utils";
import { jsonDecode } from "@/lib/json";

export const metadata = { title: "报名" };

type Question = {
  id: string;
  prompt: string;
  required: boolean;
  type: "text" | "long-text" | "single-choice";
  options?: string[];
};

export default async function RegisterPage({
  params,
}: {
  params: { slug: string };
}) {
  const viewer = await requireUser();
  const event = await db.event.findUnique({ where: { slug: params.slug } });
  if (!event) notFound();
  if (!canViewEvent(viewer, event)) notFound();
  const allowed = canRegister(viewer, event);
  if (!allowed.ok) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <PageHeader title="无法报名" />
        <Card>
          <CardContent className="pt-6 text-sm text-ink-muted">
            {allowed.reason}
          </CardContent>
        </Card>
      </div>
    );
  }

  const existing = await db.registration.findUnique({
    where: { eventId_userId: { eventId: event.id, userId: viewer.id } },
  });
  if (existing && existing.status !== "CANCELLED" && existing.status !== "DECLINED") {
    redirect(`/events/${event.slug}`);
  }

  const questions = jsonDecode<Question[]>(event.customQuestions) ?? [];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        eyebrow={event.title}
        title="报名"
        description={`${formatTimeRange(event.startAt, event.endAt)}${
          event.requireApproval ? " · 报名需组织者审核" : ""
        }`}
      />
      <RegistrationForm
        eventId={event.id}
        slug={event.slug}
        questions={questions}
      />
    </div>
  );
}
