"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-context";
import { submitReport } from "./actions";

export function ReportButton({
  targetType,
  targetId,
  children,
  className,
}: {
  targetType: "USER" | "EVENT" | "COMMENT";
  targetId: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  async function onSubmit() {
    if (reason.trim().length < 10) {
      toast({ title: "请简述举报原因", variant: "danger" });
      return;
    }
    setPending(true);
    const res = await submitReport({ targetType, targetId, reason: reason.trim() });
    setPending(false);
    if (res.ok) {
      toast({ title: "已收到举报，会尽快处理", variant: "success" });
      setOpen(false);
      setReason("");
    } else {
      toast({ title: "提交失败", description: res.error, variant: "danger" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className={className}>
          {children ?? "举报"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>举报</DialogTitle>
          <DialogDescription>
            请简单描述发生了什么。管理员会在审核后采取相应措施。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="report-reason">举报原因</Label>
          <Textarea
            id="report-reason"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="发生了什么、涉及哪些行为、有无证据……"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button variant="destructive" onClick={onSubmit} disabled={pending}>
            {pending ? "正在提交..." : "提交举报"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
