"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast-context";

export function CancelMyRegistrationButton({ registrationId }: { registrationId: string }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={async () => {
        if (!window.confirm("确认取消报名？")) return;
        setPending(true);
        const res = await api.events.cancelRegistration(registrationId);
        setPending(false);
        if (res.ok) {
          toast({ title: "已取消报名", variant: "success" });
          window.location.reload();
        } else {
          toast({ title: "操作失败", variant: "danger" });
        }
      }}
    >
      取消报名
    </Button>
  );
}
