"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { api, type Comment } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { canComment } from "@/lib/access";
import { useToast } from "@/components/ui/toast-context";
import { relativeTime } from "@/lib/utils";
import { toQueryRoute } from "@/lib/query-routing";

export function CommentSection({ postId }: { postId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const refresh = React.useCallback(() => {
    api.posts
      .listComments(postId)
      .then((res) => setComments(res.comments))
      .catch(() => setComments([]));
  }, [postId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.posts.postComment(postId, body.trim());
      if (res.hidden) {
        toast({
          title: "评论已提交,但已转人工复核",
          description: "通过后会公开显示。",
        });
      } else {
        toast({ title: "已发表" });
      }
      setBody("");
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "发表失败";
      toast({ title: "评论失败", description: msg, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="font-serif text-h2">讨论 ({comments.length})</h2>

      {canComment(user) ? (
        <form onSubmit={submit} className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="说点什么？所有评论会经过 AI 审核与人工复核。"
            rows={3}
            maxLength={4000}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !body.trim()} size="sm">
              {submitting ? "发表中…" : "发表"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">
          完成认证后即可评论。<Link href={toQueryRoute("/me")} className="underline">前往个人中心</Link>
        </p>
      )}

      <div className="space-y-6">
        {comments.length === 0 ? (
          <p className="text-sm text-ink-subtle">还没有评论。第一个开口的人不必矜持。</p>
        ) : (
          comments.map((c) => {
            const isBot = c.is_bot === 1;
            return (
              <div
                key={c.id}
                className={
                  "flex gap-3 " +
                  (isBot ? "rounded-lg bg-trans-blue-soft/40 p-3 border border-trans-blue/30" : "")
                }
              >
                <Avatar className="h-8 w-8 flex-none">
                  {c.author_avatar ? (
                    <AvatarImage src={c.author_avatar} alt={c.author_name} />
                  ) : null}
                  <AvatarFallback>{c.author_name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-xs text-ink-subtle flex-wrap">
                    <Link
                      href={toQueryRoute(`/u/${c.author_handle}`)}
                      className="text-ink font-medium hover:underline"
                    >
                      {c.author_name}
                    </Link>
                    {isBot ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-trans-blue/20 px-1.5 py-0.5 text-[10px] font-medium text-trans-blue-deep">
                        <Sparkles className="h-2.5 w-2.5" />
                        AI 助手
                      </span>
                    ) : null}
                    <span>{relativeTime(new Date(c.created_at))}</span>
                    {c.is_hidden ? <span className="text-amber-700">[已隐藏]</span> : null}
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{c.body}</p>
                  {isBot ? (
                    <p className="text-[11px] text-ink-subtle italic">
                      由小T自动生成,仅供参考。重要决定还是请咨询专业人士。
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
