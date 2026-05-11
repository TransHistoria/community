"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast-context";

export function CancelEventButton({ eventId, onCancelled }: { eventId: string; onCancelled?: () => void }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  return (
    <Button
      variant="destructive"
      disabled={pending}
      onClick={async () => {
        if (!window.confirm("确认取消这场活动？\n\n所有报名者都会收到通知。此操作无法撤销。")) return;
        setPending(true);
        const res = await api.events.cancel(eventId);
        setPending(false);
        if (res.ok) {
          toast({ title: "活动已取消", variant: "success" });
          onCancelled?.();
        } else {
          toast({ title: "失败", variant: "danger" });
        }
      }}
    >
      取消活动
    </Button>
  );
}
