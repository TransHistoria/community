import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "编辑主页" };

export default async function MeProfilePage() {
  const viewer = await requireUser();
  const user = await db.user.findUnique({ where: { id: viewer.id } });
  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        eyebrow="我的主页"
        title="编辑主页"
        description="这些信息会展示给已登录的社群成员。所有项都可以随时修改。"
      />
      <ProfileForm
        initial={{
          handle: user.handle,
          displayName: user.displayName,
          pronouns: user.pronouns ?? "",
          genderIdentity: user.genderIdentity ?? "",
          bio: user.bio ?? "",
          avatarUrl: user.avatarUrl ?? null,
        }}
      />
    </div>
  );
}
