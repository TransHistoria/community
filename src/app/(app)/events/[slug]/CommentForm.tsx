"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-context";
import { postComment } from "@/app/(app)/events/actions";

export function CommentForm({
  eventId,
  parentId,
  compact,
}: {
  eventId: string;
  parentId?: string;
  compact?: boolean;
}) {
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [open, setOpen] = React.useState(!compact);
  const { toast } = useToast();
  const router = useRouter();

  if (compact && !open) {
    return (
      <button
        className="text-xs text-trans-blue-deep hover:underline"
        onClick={() => setOpen(true)}
      >
        回复
      </button>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim().length === 0) return;
    setPending(true);
    const res = await postComment({ eventId, parentId, body });
    setPending(false);
    if (res.ok) {
      setBody("");
      if (compact) setOpen(false);
      router.refresh();
    } else {
      toast({ title: "发送失败", description: res.error, variant: "danger" });
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={compact ? 2 : 3}
        placeholder={parentId ? "回复…" : "支持 Markdown，简短的也可以"}
      />
      <div className="flex justify-end gap-2">
        {compact ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
          >
            取消
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "..." : parentId ? "回复" : "发布评论"}
        </Button>
      </div>
    </form>
  );
}
