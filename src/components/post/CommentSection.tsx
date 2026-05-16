"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Trash2, Reply } from "lucide-react";
import { api, type Comment } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { canComment } from "@/lib/access";
import { useToast } from "@/components/ui/toast-context";
import { relativeTime } from "@/lib/utils";
import { toQueryRoute } from "@/lib/query-routing";

type CommentNode = Comment & { children: CommentNode[] };

function buildTree(flat: Comment[]): CommentNode[] {
  const byId = new Map<string, CommentNode>();
  flat.forEach((c) => byId.set(c.id, { ...c, children: [] }));
  const roots: CommentNode[] = [];
  byId.forEach((node) => {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export function CommentSection({ postId }: { postId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [comments, setComments] = React.useState<Comment[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [replyParent, setReplyParent] = React.useState<{ id: string; name: string } | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const res = await api.posts.listComments(postId);
      setComments(res.comments);
      setNextCursor(res.nextCursor);
    } catch {
      setComments([]);
    }
  }, [postId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.posts.listComments(postId, nextCursor);
      setComments((prev) => [...prev, ...res.comments]);
      setNextCursor(res.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.posts.postComment(postId, body.trim(), replyParent?.id);
      toast({
        title: res.hidden ? "评论已提交,但已转人工复核" : "已发表",
        description: res.hidden ? "通过后会公开显示。" : undefined,
        variant: res.hidden ? "default" : "success",
      });
      setBody("");
      setReplyParent(null);
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "发表失败";
      toast({ title: "评论失败", description: msg, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  async function removeComment(cid: string) {
    if (!confirm("确认删除这条评论？")) return;
    try {
      await api.posts.deleteComment(cid);
      toast({ title: "已删除", variant: "success" });
      await reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "删除失败";
      toast({ title: "删除失败", description: msg, variant: "danger" });
    }
  }

  const tree = buildTree(comments);

  return (
    <section className="space-y-6">
      <h2 className="font-serif text-h2">讨论 ({comments.length})</h2>

      {canComment(user) ? (
        <form onSubmit={submit} className="space-y-2">
          {replyParent ? (
            <div className="flex items-center justify-between rounded-md border border-border bg-bg-muted px-3 py-1.5 text-xs">
              <span>
                回复 <span className="font-medium text-ink">@{replyParent.name}</span>
              </span>
              <button
                type="button"
                onClick={() => setReplyParent(null)}
                className="text-ink-subtle hover:text-ink"
              >
                取消
              </button>
            </div>
          ) : null}
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={
              replyParent
                ? `回复 @${replyParent.name}…`
                : "说点什么？所有评论会经过 AI 审核。"
            }
            rows={3}
            maxLength={4000}
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={submitting || !body.trim()} size="sm">
              {submitting ? "发表中…" : replyParent ? "回复" : "发表"}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">
          完成认证后即可评论。<Link href={toQueryRoute("/me")} className="underline">前往个人中心</Link>
        </p>
      )}

      <div className="space-y-6">
        {tree.length === 0 ? (
          <p className="text-sm text-ink-subtle">还没有评论。第一个开口的人不必矜持。</p>
        ) : (
          tree.map((c) => (
            <CommentItem
              key={c.id}
              node={c}
              depth={0}
              currentUserId={user?.id}
              isAdmin={user?.tier === "ADMIN"}
              onReply={(node) => setReplyParent({ id: node.id, name: node.author_name })}
              onDelete={removeComment}
            />
          ))
        )}
        {nextCursor ? (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "加载中…" : "加载更多评论"}
            </Button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CommentItem({
  node,
  depth,
  currentUserId,
  isAdmin,
  onReply,
  onDelete,
}: {
  node: CommentNode;
  depth: number;
  currentUserId?: string;
  isAdmin: boolean;
  onReply: (node: CommentNode) => void;
  onDelete: (cid: string) => void;
}) {
  const isBot = node.is_bot === 1;
  const isAuthor = currentUserId && node.author_id === currentUserId;
  const canDelete = isAuthor || isAdmin;
  // Visual nesting is handled by the parent's pl-4 + ml-11 below; no per-row indent.

  return (
    <div>
      <div
        className={
          "flex gap-3 " +
          (isBot ? "rounded-lg bg-trans-blue-soft/40 p-3 border border-trans-blue/30" : "")
        }
      >
        <Avatar className="h-8 w-8 flex-none">
          {node.author_avatar ? (
            <AvatarImage src={node.author_avatar} alt={node.author_name} />
          ) : null}
          <AvatarFallback>{node.author_name.slice(0, 1)}</AvatarFallback>
        </Avatar>
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-baseline gap-2 text-xs text-ink-subtle flex-wrap">
            <Link
              href={toQueryRoute(`/u/${node.author_handle}`)}
              className="text-ink font-medium hover:underline"
            >
              {node.author_name}
            </Link>
            {isBot ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-trans-blue/20 px-1.5 py-0.5 text-[10px] font-medium text-trans-blue-deep">
                <Sparkles className="h-2.5 w-2.5" />
                AI 助手
              </span>
            ) : null}
            <span>{relativeTime(new Date(node.created_at))}</span>
            {node.is_hidden ? <span className="text-amber-700">[已隐藏]</span> : null}
          </div>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{node.body}</p>
          {isBot ? (
            <p className="text-[11px] text-ink-subtle italic">
              由小T自动生成,仅供参考。重要决定还是请咨询专业人士。
            </p>
          ) : null}
          <div className="flex items-center gap-2 pt-1">
            {currentUserId && !isBot ? (
              <button
                type="button"
                onClick={() => onReply(node)}
                className="inline-flex items-center gap-1 text-[11px] text-ink-subtle hover:text-ink"
              >
                <Reply className="h-3 w-3" /> 回复
              </button>
            ) : null}
            {canDelete ? (
              <button
                type="button"
                onClick={() => onDelete(node.id)}
                className="inline-flex items-center gap-1 text-[11px] text-ink-subtle hover:text-rose-600"
              >
                <Trash2 className="h-3 w-3" /> 删除
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {node.children.length > 0 ? (
        <div className="mt-3 ml-11 border-l border-border pl-4 space-y-4">
          {node.children.map((child) => (
            <CommentItem
              key={child.id}
              node={child}
              depth={depth + 1}
              currentUserId={currentUserId}
              isAdmin={isAdmin}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
