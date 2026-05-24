"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";
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
  status: string;
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
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [body, setBody] = React.useState(initial?.body ?? "");
  const [visibility, setVisibility] = React.useState(initial?.visibility ?? "VERIFIED");
  const isDraftEdit = mode === "edit" && initial?.status === "DRAFT";
  const [submitting, setSubmitting] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  function insertAtCursor(snippet: string) {
    const ta = bodyRef.current;
    if (!ta) {
      setBody((prev) => prev + snippet);
      return;
    }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const next = body.slice(0, start) + snippet + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const caret = start + snippet.length;
      ta.setSelectionRange(caret, caret);
    });
  }

  async function uploadImage(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "请选择图片文件", variant: "danger" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "图片大小请控制在 5MB 以内", variant: "danger" });
      return;
    }
    setUploading(true);
    try {
      const res = await api.files.upload(file, "post-image");
      insertAtCursor(`\n![](${res.url})\n`);
      toast({ title: "图片已插入", variant: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "上传失败";
      toast({ title: "图片上传失败", description: msg, variant: "danger" });
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent, asDraft = false) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = { title: title.trim(), body: body.trim(), visibility };

      if (mode === "create") {
        const res = await api.posts.create(payload, asDraft);
        if (asDraft) {
          toast({
            title: "已保存为草稿",
            description: "草稿只有你能看到。准备好了再发布。",
            variant: "success",
          });
          router.push(toQueryRoute(`/me/drafts`));
        } else {
          toast({
            title: "已提交",
            description: "我们正在审核,通过后会出现在广场。可以去通知页面看进度。",
            variant: "success",
          });
          router.push(toQueryRoute(`/posts/${res.id}`));
        }
      } else if (postId) {
        await api.posts.update(postId, payload, asDraft);
        toast({ title: asDraft ? "草稿已保存" : "已保存", variant: "success" });
        if (asDraft) {
          router.push(toQueryRoute(`/posts/${postId}/edit`));
        } else {
          router.push(toQueryRoute(`/posts/${postId}`));
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "提交失败";
      toast({ title: "提交失败", description: msg, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={(e) => submit(e, false)} className="space-y-6">
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
            <div className="flex items-center justify-between">
              <Label htmlFor="body">正文</Label>
              <label className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink cursor-pointer">
                <ImagePlus className="h-3.5 w-3.5" />
                {uploading ? "上传中…" : "插入图片"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      uploadImage(f);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
            <Textarea
              id="body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="写得具体一点,让大家更容易帮到你或被你帮到。支持 Markdown。也可以贴链接,会自动渲染。"
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
        {mode === "create" ? (
          <Button
            type="button"
            variant="outline"
            disabled={submitting || !title.trim() || !body.trim()}
            onClick={(e) => submit(e as unknown as React.FormEvent, true)}
          >
            存为草稿
          </Button>
        ) : isDraftEdit ? (
          <Button
            type="button"
            variant="outline"
            disabled={submitting || !title.trim() || !body.trim()}
            onClick={(e) => submit(e as unknown as React.FormEvent, true)}
          >
            保存草稿
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "提交中…" : mode === "create" ? "发布" : isDraftEdit ? "发布" : "保存"}
        </Button>
      </div>
    </form>
  );
}
