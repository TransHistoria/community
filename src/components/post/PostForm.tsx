"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-context";
import { toQueryRoute } from "@/lib/query-routing";

type Mode = "create" | "edit";

type Initial = Partial<{
  title: string;
  body: string;
  visibility: string;
}>;

export function PostForm({
  mode,
  postId,
  initial,
}: {
  mode: Mode;
  postId?: string;
  initial?: Initial;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [body, setBody] = React.useState(initial?.body ?? "");
  const [visibility, setVisibility] = React.useState(initial?.visibility ?? "VERIFIED");
  const [submitting, setSubmitting] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        visibility,
      };

      if (mode === "create") {
        const res = await api.posts.create(payload);
        toast({
          title: "已提交",
          description: "我们正在审核,通过后会出现在广场。可以去通知页面看进度。",
          variant: "success",
        });
        router.push(toQueryRoute(`/posts/${res.id}`));
      } else if (postId) {
        await api.posts.update(postId, payload);
        toast({ title: "已保存", variant: "success" });
        router.push(toQueryRoute(`/posts/${postId}`));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "提交失败";
      toast({ title: "提交失败", description: msg, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="一句话写清楚要点"
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">正文</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="写得具体一点,让大家更容易帮到你或被你帮到。支持 Markdown。"
              minLength={5}
              maxLength={20000}
              rows={10}
              required
            />
            <p className="text-xs text-ink-subtle">{body.length} / 20000</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="visibility">可见性</Label>
            <select
              id="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="PUBLIC">公开(所有访客)</option>
              <option value="VERIFIED">认证成员可见(默认)</option>
              <option value="TRUSTED">仅信任成员可见</option>
            </select>
          </div>
          <p className="text-xs text-ink-subtle">
            发布后系统会自动分类到合适的板块。如内容涉及违规,会在你的通知里告知。
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          取消
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "提交中…" : mode === "create" ? "发布" : "保存"}
        </Button>
      </div>
    </form>
  );
}
