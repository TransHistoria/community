"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-context";

export function UnblockButton({ targetHandle, onUnblocked }: { targetHandle: string; onUnblocked?: () => void }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await api.users.unblock(targetHandle);
          toast({ title: "已解除拉黑", variant: "success" });
          onUnblocked?.();
        } catch {
          toast({ title: "操作失败", variant: "danger" });
        } finally {
          setPending(false);
        }
      }}
    >
      解除
    </Button>
  );
}
