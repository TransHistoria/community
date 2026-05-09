"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { decideContactRequest } from "./actions";
import { useToast } from "@/components/ui/toast-context";
import { useRouter } from "next/navigation";

export function DecisionButtons({ requestId }: { requestId: string }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function decide(decision: "APPROVED" | "DECLINED") {
    setPending(true);
    const res = await decideContactRequest(requestId, decision);
    setPending(false);
    if (res.ok) {
      toast({
        title: decision === "APPROVED" ? "已同意" : "已拒绝",
        variant: "success",
      });
      router.refresh();
    } else {
      toast({ title: "操作失败", description: res.error, variant: "danger" });
    }
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => decide("DECLINED")}
      >
        拒绝
      </Button>
      <Button size="sm" disabled={pending} onClick={() => decide("APPROVED")}>
        同意
      </Button>
    </div>
  );
}
