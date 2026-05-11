"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast-context";
import { api } from "@/lib/api";

const HIDE_LABEL: Record<string, string> = {
  USER: "封禁该用户",
  EVENT: "取消该活动",
  COMMENT: "隐藏该评论",
};

export function ReportDecisionForm({
  reportId,
  targetType,
  onDecided,
}: {
  reportId: string;
  targetType: "USER" | "EVENT" | "COMMENT";
  onDecided?: () => void;
}) {
  const [note, setNote] = React.useState("");
  const [hide, setHide] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  async function decide(decision: "RESOLVED" | "DISMISSED") {
    setPending(true);
    const res = await api.admin.resolveReport(reportId, decision, note || undefined, hide);
    setPending(false);
    if (res.ok) {
      toast({ title: "已处理", variant: "success" });
      onDecided?.();
    } else {
      toast({ title: "失败", variant: "danger" });
    }
  }

  return (
    <div className="space-y-2">
      <Input placeholder="处理备注" value={note} onChange={(e) => setNote(e.target.value)} />
      <label className="inline-flex items-center gap-2 text-sm">
        <Checkbox checked={hide} onCheckedChange={(v) => setHide(v === true)} />
        <span>同时{HIDE_LABEL[targetType]}</span>
      </label>
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={pending} onClick={() => decide("DISMISSED")}>
          驳回（无问题）
        </Button>
        <Button disabled={pending} onClick={() => decide("RESOLVED")}>
          处理（属实）
        </Button>
      </div>
    </div>
  );
}
