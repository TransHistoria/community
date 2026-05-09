import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { UnblockButton } from "./UnblockButton";

export const metadata = { title: "拉黑列表" };

export default async function MeBlocksPage() {
  const viewer = await requireUser();
  const blocks = await db.block.findMany({
    where: { blockerId: viewer.id },
    include: {
      blocked: { select: { handle: true, displayName: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        eyebrow="设置"
        title="拉黑列表"
        description="被拉黑的成员对你不可见，你的内容也不会出现在 ta 的视野中。"
      />
      {blocks.length === 0 ? (
        <EmptyState title="没有拉黑任何人" />
      ) : (
        <div className="space-y-2">
          {blocks.map((b) => (
            <Card key={b.id}>
              <CardContent className="py-3 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <span className="font-medium">{b.blocked.displayName}</span>
                  <span className="text-ink-subtle"> @{b.blocked.handle}</span>
                </div>
                <UnblockButton targetUserId={b.blockedId} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
