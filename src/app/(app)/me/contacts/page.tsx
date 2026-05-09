import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { ContactsManager } from "./ContactsManager";

export const metadata = { title: "联系方式" };

export default async function MeContactsPage() {
  const viewer = await requireUser();
  const contacts = await db.contactMethod.findMany({
    where: { userId: viewer.id },
    orderBy: { order: "asc" },
  });
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        eyebrow="我的资料"
        title="联系方式"
        description="管理你愿意展示给他人的联系方式，每一项都可以独立设置可见范围。"
      />
      <ContactsManager initial={contacts} />
    </div>
  );
}
