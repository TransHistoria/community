"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/toast-context";
import { EyeOff } from "lucide-react";

export function HideCommentButton({ commentId, onHidden }: { commentId: string; onHidden?: () => void }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        if (!window.confirm("确定隐藏这条评论？")) return;
        setPending(true);
        const res = await api.events.hideComment(commentId);
        setPending(false);
        if (res.ok) {
          toast({ title: "已隐藏", variant: "success" });
          onHidden?.();
        } else {
          toast({ title: "操作失败", variant: "danger" });
        }
      }}
      disabled={pending}
      className="text-ink-subtle hover:text-destructive"
    >
      <EyeOff className="h-3.5 w-3.5" />
    </Button>
  );
}
