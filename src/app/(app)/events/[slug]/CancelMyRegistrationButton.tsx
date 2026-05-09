"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cancelMyRegistration } from "@/app/(app)/events/actions";
import { useToast } from "@/components/ui/toast-context";
import { useRouter } from "next/navigation";

export function CancelMyRegistrationButton({ eventId }: { eventId: string }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        if (!window.confirm("确认取消报名？")) return;
        setPending(true);
        const res = await cancelMyRegistration(eventId);
        setPending(false);
        if (res.ok) {
          toast({ title: "已取消报名", variant: "success" });
          router.refresh();
        } else {
          toast({ title: "操作失败", description: res.error, variant: "danger" });
        }
      }}
    >
      取消报名
    </Button>
  );
}
