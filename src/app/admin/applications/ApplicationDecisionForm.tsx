"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast-context";
import { api } from "@/lib/api";

export function ApplicationDecisionForm({ applicationId, onDecided }: { applicationId: string; onDecided?: () => void }) {
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  async function decide(action: "approve" | "reject") {
    setPending(true);
    const res = await api.applications.decide(applicationId, action === "approve" ? "APPROVED" : "REJECTED", note || undefined);
    setPending(false);
    if (res.ok) {
      toast({ title: action === "approve" ? "已通过" : "已拒绝", variant: "success" });
      onDecided?.();
    } else {
      toast({ title: "失败", variant: "danger" });
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Input placeholder="审核备注（可选）" value={note} onChange={(e) => setNote(e.target.value)} className="flex-1 min-w-[180px]" />
      <Button variant="outline" disabled={pending} onClick={() => decide("reject")}>拒绝</Button>
      <Button disabled={pending} onClick={() => decide("approve")}>通过</Button>
    </div>
  );
}

export function ApplicationDecisionForm({ applicationId }: { applicationId: string }) {
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function decide(action: "approve" | "reject") {
    setPending(true);
    const fn = action === "approve" ? approveApplication : rejectApplication;
    const res = await fn(applicationId, note || undefined);
    setPending(false);
    if (res.ok) {
      toast({ title: action === "approve" ? "已通过" : "已拒绝", variant: "success" });
      router.refresh();
    } else {
      toast({ title: "失败", description: res.error, variant: "danger" });
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Input
        placeholder="审核备注（可选，仅记录于审计日志）"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="flex-1 min-w-[180px]"
      />
      <Button variant="outline" disabled={pending} onClick={() => decide("reject")}>
        拒绝
      </Button>
      <Button disabled={pending} onClick={() => decide("approve")}>
        通过
      </Button>
    </div>
  );
}
