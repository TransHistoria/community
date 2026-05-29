"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Paperclip, X, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-context";
import { toQueryRoute } from "@/lib/query-routing";
import { useAuth } from "@/contexts/AuthContext";
import { PostSection, POST_SECTION_LABEL } from "@/lib/enums";

type Mode = "create" | "edit";

type Initial = Partial<{
  title: string;
  body: string;
  section: string;
  visibility: string;
  status: string;
}>;

type UploadedFile = {
  url: string;
  previewUrl: string;
  name: string;
  size: number;
  type: "image" | "attachment";
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayName(name: string): string {
  const dotIdx = name.lastIndexOf(".");
  return dotIdx > 0 ? name.slice(0, dotIdx) : name;
}

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
  const { user } = useAuth();
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [body, setBody] = React.useState(initial?.body ?? "");
  const [section, setSection] = React.useState(initial?.section ?? "QUESTION");
  const [visibility, setVisibility] = React.useState(initial?.visibility ?? "VERIFIED");
  const isDraftEdit = mode === "edit" && initial?.status === "DRAFT";
  const isAdmin = user?.tier === "ADMIN";
  const [submitting, setSubmitting] = React.useState(false);

  const [uploads, setUploads] = React.useState<UploadedFile[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const attachmentInputRef = React.useRef<HTMLInputElement>(null);

  const blobUrlsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    return () => {
      for (const url of blobUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const uploadFile = React.useCallback(
    async (file: File, purpose: string) => {
      const isImage = file.type.startsWith("image/");
      const type = isImage ? "image" as const : "attachment" as const;
      const maxSize = isImage ? 8 * 1024 * 1024 : 20 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: `文件过大，${isImage ? "图片" : "附件"}不能超过 ${isImage ? "8MB" : "20MB"}`,
          variant: "danger",
        });
        return;
      }

      const blobUrl = URL.createObjectURL(file);
      blobUrlsRef.current.push(blobUrl);

      setUploading(true);
      try {
        const res = await api.files.upload(file, purpose);
        const entry: UploadedFile = {
          url: res.url,
          previewUrl: blobUrl,
          name: file.name,
          size: file.size,
          type,
        };
        setUploads((prev) => [...prev, entry]);

        const markdown = isImage
          ? `![${file.name}](${res.url})`
          : `[${file.name}](${res.url})`;
        const ta = bodyRef.current;
        if (ta) {
          const start = ta.selectionStart ?? body.length;
          const end = ta.selectionEnd ?? body.length;
          const prefix = start > 0 && body[start - 1] !== "\n" ? "\n" : "";
          const snippet = `${prefix}${markdown}\n`;
          const next = body.slice(0, start) + snippet + body.slice(end);
          setBody(next);
          requestAnimationFrame(() => {
            ta.focus();
            const caret = start + snippet.length;
            ta.setSelectionRange(caret, caret);
          });
        } else {
          setBody((prev) => prev + `\n${markdown}\n`);
        }
        toast({ title: isImage ? "图片已插入" : "附件已插入", variant: "success" });
      } catch (err) {
        URL.revokeObjectURL(blobUrl);
        blobUrlsRef.current = blobUrlsRef.current.filter((u) => u !== blobUrl);
        const msg = err instanceof Error ? err.message : "上传失败";
        toast({ title: "上传失败", description: msg, variant: "danger" });
      } finally {
        setUploading(false);
      }
    },
    [body.length, toast],
  );

  function removeUpload(idx: number) {
    const removed = uploads[idx];
    if (removed) {
      URL.revokeObjectURL(removed.previewUrl);
      blobUrlsRef.current = blobUrlsRef.current.filter((u) => u !== removed.previewUrl);
    }
    setUploads((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit(
    e: React.FormEvent,
    asDraft = false,
    adminStatus?: "DRAFT" | "PUBLISHED",
  ) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload = { title: title.trim(), body: body.trim(), section, visibility };

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
            description: "我们正在审核，通过后会出现在广场。可以去通知页面看进度。",
            variant: "success",
          });
          router.push(toQueryRoute(`/posts/${res.id}`));
        }
      } else if (postId) {
        await api.posts.update(
          postId,
          adminStatus ? { ...payload, adminStatus } : payload,
          asDraft,
        );
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
    <form
      onSubmit={(e) => submit(e, false, isAdmin && isDraftEdit ? "PUBLISHED" : undefined)}
      className="space-y-6"
    >
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
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="写得具体一点，让大家更容易帮到你或被你帮到。支持 Markdown。"
              minLength={5}
              maxLength={20000}
              rows={10}
              required
            />
            <p className="text-xs text-ink-subtle">{body.length} / 20000</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="section">板块</Label>
            <select
              id="section"
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              {([["QUESTION","提问求助"],["OFFLINE_MEETUP","线下交友"],["MEDICAL","医疗信息"],["RESOURCE","资源分享"],["REFLECTION","感悟"]] as const).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus className="h-4 w-4 mr-1.5" />
              插入图片
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => attachmentInputRef.current?.click()}
            >
              <Paperclip className="h-4 w-4 mr-1.5" />
              插入附件
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  uploadFile(f, "post-image");
                  e.target.value = "";
                }
              }}
            />
            <input
              ref={attachmentInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  uploadFile(f, "post-attachment");
                  e.target.value = "";
                }
              }}
            />
            {uploading && (
              <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                <Loader2 className="h-3 w-3 animate-spin" />
                上传中…
              </span>
            )}
            <span className="text-xs text-ink-subtle">
              图片 8MB · 附件 20MB
            </span>
          </div>

          {uploads.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-ink-muted">已插入的文件</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {uploads.map((f, idx) => (
                  <div
                    key={`${f.url}-${idx}`}
                    className="relative group rounded-lg border border-border bg-card overflow-hidden"
                  >
                    {f.type === "image" ? (
                      <div className="aspect-video bg-muted flex items-center justify-center">
                        <img
                          src={f.previewUrl}
                          alt={f.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="aspect-video bg-muted flex items-center justify-center p-3">
                        <div className="text-center space-y-1">
                          <Paperclip className="h-6 w-6 mx-auto text-ink-muted" />
                          <p className="text-xs text-ink-muted truncate max-w-[140px]" title={f.name}>
                            {displayName(f.name)}
                          </p>
                          <p className="text-[10px] text-ink-subtle">{formatSize(f.size)}</p>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => removeUpload(idx)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      title="移除"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              <option value="PUBLIC">公开（所有访客）</option>
              <option value="VERIFIED">认证成员可见（默认）</option>
              <option value="TRUSTED">仅信任成员可见</option>
            </select>
          </div>
          <p className="text-xs text-ink-subtle">
            发布后内容会经过 AI 审核;违规会被退回,边界内容会进入人工复核。
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
        {mode === "edit" && isAdmin && !isDraftEdit ? (
          <Button
            type="button"
            variant="outline"
            disabled={submitting || !title.trim() || !body.trim()}
            onClick={(e) => submit(e as unknown as React.FormEvent, false, "DRAFT")}
          >
            转为草稿
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "提交中…" : mode === "create" ? "发布" : isDraftEdit ? "发布" : "保存"}
        </Button>
      </div>
    </form>
  );
}