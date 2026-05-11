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
import { api } from "@/lib/api";

export function ContactRequestButton({
  targetHandle,
  contactId,
  contactLabel,
}: {
  targetHandle: string;
  contactId: string;
  contactLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  async function onSubmit() {
    if (reason.trim().length < 20) {
      toast({ title: "理由太短", description: "请至少 20 字", variant: "danger" });
      return;
    }
    setPending(true);
    const res = await api.users.sendContactRequest(targetHandle, { contactId, reason: reason.trim() });
    setPending(false);
    if (res.ok) {
      toast({ title: "申请已发送", description: "对方收到通知后会决定是否同意。", variant: "success" });
      setOpen(false);
      setReason("");
    } else {
      toast({ title: "申请失败", variant: "danger" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="soft">申请查看</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>申请查看「{contactLabel}」</DialogTitle>
          <DialogDescription>
            请简短说明你为什么想查看 ta 的这项联系方式。
            对方会收到你的理由，并自主决定是否同意。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">理由（不少于 20 字）</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="例如：我们在某次活动中聊得不错，想私下继续聊聊关于……的话题。"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? "正在发送..." : "发送申请"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ContactRequestButton({
  targetHandle,
  contactId,
  contactLabel,
}: {
  targetHandle: string;
  contactId: string;
  contactLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  async function onSubmit() {
    if (reason.trim().length < 20) {
      toast({ title: "理由太短", description: "请至少 20 字", variant: "danger" });
      return;
    }
    setPending(true);
    const res = await requestContact({ targetHandle, contactId, reason: reason.trim() });
    setPending(false);
    if (res.ok) {
      toast({
        title: "申请已发送",
        description: "对方收到通知后会决定是否同意。",
        variant: "success",
      });
      setOpen(false);
      setReason("");
    } else {
      toast({ title: "申请失败", description: res.error, variant: "danger" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="soft">
          申请查看
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>申请查看「{contactLabel}」</DialogTitle>
          <DialogDescription>
            请简短说明你为什么想查看 ta 的这项联系方式。
            对方会收到你的理由，并自主决定是否同意。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">理由（不少于 20 字）</Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="例如：我们在某次活动中聊得不错，想私下继续聊聊关于……的话题。"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? "正在发送..." : "发送申请"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
