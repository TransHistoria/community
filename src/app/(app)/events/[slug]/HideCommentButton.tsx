"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { hideComment } from "@/app/(app)/events/actions";
import { useToast } from "@/components/ui/toast-context";
import { useRouter } from "next/navigation";
import { EyeOff } from "lucide-react";

export function HideCommentButton({ commentId }: { commentId: string }) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={async () => {
        if (!window.confirm("确定隐藏这条评论？")) return;
        setPending(true);
        const res = await hideComment(commentId);
        setPending(false);
        if (res.ok) {
          toast({ title: "已隐藏", variant: "success" });
          router.refresh();
        } else {
          toast({ title: "操作失败", description: res.error, variant: "danger" });
        }
      }}
      disabled={pending}
      className="text-ink-subtle hover:text-destructive"
    >
      <EyeOff className="h-3.5 w-3.5" />
    </Button>
  );
}
