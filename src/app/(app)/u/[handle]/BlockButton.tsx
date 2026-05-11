"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast-context";
import { useRouter } from "next/navigation";

export function BlockButton({ targetHandle }: { targetHandle: string }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function onClick() {
    if (!window.confirm(`确定要拉黑 @${targetHandle} 吗？\n\n拉黑后你们将互相不可见，对方的评论与活动也不会出现在你的视野中。可在「设置 / 拉黑列表」里恢复。`)) return;
    setPending(true);
    const res = await api.users.block(targetHandle);
    setPending(false);
    if (res.ok) {
      toast({ title: "已拉黑", variant: "success" });
      router.push("/me");
    } else {
      toast({ title: "操作失败", variant: "danger" });
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={onClick} disabled={pending} className="text-ink-muted">
      <ShieldOff className="h-3.5 w-3.5" />
      拉黑
    </Button>
  );
}
