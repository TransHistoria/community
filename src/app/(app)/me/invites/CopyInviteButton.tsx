"use client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-context";
import { Copy } from "lucide-react";

export function CopyInviteButton({ code }: { code: string }) {
  const { toast } = useToast();
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
          toast({ title: "邀请码已复制", variant: "success" });
        } catch {
          toast({ title: "复制失败", description: code, variant: "danger" });
        }
      }}
    >
      <Copy className="h-3.5 w-3.5" /> 复制
    </Button>
  );
}
