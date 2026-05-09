import { requireTier } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { EventForm } from "@/components/event/EventForm";

export const metadata = { title: "创建活动" };

export default async function NewEventPage() {
  await requireTier("VERIFIED");
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
