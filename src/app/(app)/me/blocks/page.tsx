"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { UnblockButton } from "./UnblockButton";

type BlockEntry = {
  id: string;
  blocked_id?: string;
  blocked_handle?: string;
  blocked_name?: string;
  handle?: string;
  displayName?: string;
};

export default function MeBlocksPage() {
  const [blocks, setBlocks] = React.useState<BlockEntry[]>([]);

  const load = React.useCallback(() => {
    api.users.myBlocks().then(({ blocks: b }) => setBlocks(b as BlockEntry[]));
  }, []);

  React.useEffect(() => { load(); }, [load]);

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
          {blocks.map((b) => {
            const handle = b.blocked_handle ?? b.handle ?? "";
            const name = b.blocked_name ?? b.displayName ?? handle;
            return (
              <Card key={b.id}>
                <CardContent className="py-3 flex items-center justify-between gap-3">
                  <div className="text-sm">
                    <span className="font-medium">{name}</span>
                    <span className="text-ink-subtle"> @{handle}</span>
                  </div>
                  <UnblockButton targetHandle={handle} onUnblocked={load} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
