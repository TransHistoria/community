"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-context";

export function DecisionButtons({ requestId, onDecided }: { requestId: string; onDecided?: () => void }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  async function decide(decision: "APPROVED" | "DECLINED") {
    setPending(true);
    try {
      await api.users.decideContactRequest(requestId, decision);
      toast({ title: decision === "APPROVED" ? "已同意" : "已拒绝", variant: "success" });
      onDecided?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "操作失败";
      toast({ title: "操作失败", description: msg, variant: "danger" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" disabled={pending} onClick={() => decide("DECLINED")}>
        拒绝
      </Button>
      <Button size="sm" disabled={pending} onClick={() => decide("APPROVED")}>
        同意
      </Button>
    </div>
  );
}
