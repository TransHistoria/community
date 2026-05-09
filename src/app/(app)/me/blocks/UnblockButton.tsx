"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { unblockUser } from "@/app/(app)/u/[handle]/actions";
import { useToast } from "@/components/ui/toast-context";
import { useRouter } from "next/navigation";

export function UnblockButton({ targetUserId }: { targetUserId: string }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await unblockUser(targetUserId);
        setPending(false);
        toast({ title: "已解除拉黑", variant: "success" });
        router.refresh();
      }}
    >
      解除
    </Button>
  );
}
