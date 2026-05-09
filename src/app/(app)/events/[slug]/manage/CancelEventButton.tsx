"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cancelEvent } from "@/app/(app)/events/actions";
import { useToast } from "@/components/ui/toast-context";
import { useRouter } from "next/navigation";

export function CancelEventButton({ eventId }: { eventId: string }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();
  return (
    <Button
      variant="destructive"
      disabled={pending}
      onClick={async () => {
        if (
          !window.confirm(
            "确认取消这场活动？\n\n所有报名者都会收到通知。此操作无法撤销。",
          )
        )
          return;
        setPending(true);
        const res = await cancelEvent(eventId);
        setPending(false);
        if (res.ok) {
          toast({ title: "活动已取消", variant: "success" });
          router.refresh();
        } else {
          toast({ title: "失败", description: res.error, variant: "danger" });
        }
      }}
    >
      取消活动
    </Button>
  );
}
