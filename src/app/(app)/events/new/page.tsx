"use client";
import { useAuth } from "@/contexts/AuthContext";
import { canCreateEvent } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { EventForm } from "@/components/event/EventForm";

export default function NewEventPage() {
  const { user } = useAuth();
  if (!canCreateEvent(user)) return null;
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        eyebrow="活动"
        title="创建活动"
        description="创建一场你想组织的活动。线下精确地址、线上会议链接只会展示给报名通过的成员。"
      />
      <EventForm mode="create" />
    </div>
  );
}
