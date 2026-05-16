"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Trash2, ArrowLeft, Pencil, Heart, Bookmark, UserPlus, UserMinus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { api, type Post } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CommentSection } from "@/components/post/CommentSection";
import { ReportButton } from "@/components/moderation/ReportButton";
import { useToast } from "@/components/ui/toast-context";
import { TAG_LABEL, parsePostTags } from "@/lib/post-tags";
import { relativeTime } from "@/lib/utils";
import { toQueryRoute } from "@/lib/query-routing";

function PostDetailInner() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [post, setPost] = React.useState<Post | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    api.posts
      .get(id)
      .then((res) => setPost(res.post))
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-muted">帖子不存在或无权访问。</p>
      </div>
    );
  }
  if (!post || !id) return null;

  const isAuthor = !!user && user.id === post.author_id;
  const isAdmin = user?.tier === "ADMIN";
  const pending = post.status === "PENDING_REVIEW";
  const rejected = post.status === "REJECTED";
  const hidden = post.status === "HIDDEN";
  const draft = post.status === "DRAFT";
  const tags = parsePostTags(post.tags);

  async function remove() {
    if (!id) return;
    if (!confirm("确认删除这条帖子？")) return;
    try {
      await api.posts.remove(id);
      toast({ title: "已删除", variant: "success" });
      router.push(toQueryRoute("/posts"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "删除失败";
      toast({ title: "删除失败", description: msg, variant: "danger" });
    }
  }

  async function toggleLike() {
    if (!id || !user) return;
    const before = !!post?.liked;
    setPost((p) => (p ? { ...p, liked: !before, likeCount: (p.likeCount ?? 0) + (before ? -1 : 1) } : p));
    try {
      await api.posts.toggleLike(id);
    } catch {
      // revert
      setPost((p) => (p ? { ...p, liked: before, likeCount: (p.likeCount ?? 0) + (before ? 1 : -1) } : p));
    }
  }

  async function toggleBookmark() {
    if (!id || !user) return;
    const before = !!post?.bookmarked;
    setPost((p) => (p ? { ...p, bookmarked: !before } : p));
    try {
      const res = await api.posts.toggleBookmark(id);
      toast({ title: res.bookmarked ? "已收藏" : "已取消收藏", variant: "default" });
    } catch {
      setPost((p) => (p ? { ...p, bookmarked: before } : p));
    }
  }

  async function toggleSubscribe() {
    if (!post || !user) return;
    const before = !!post.subscribed;
    setPost((p) => (p ? { ...p, subscribed: !before } : p));
    try {
      if (before) {
        await api.subscriptions.unfollow("AUTHOR", post.author_id);
        toast({ title: `已取消关注 ${post.author_name}`, variant: "default" });
      } else {
        await api.subscriptions.follow("AUTHOR", post.author_id);
        toast({ title: `已关注 ${post.author_name}`, variant: "success" });
      }
    } catch {
      setPost((p) => (p ? { ...p, subscribed: before } : p));
    }
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <Link
          href={toQueryRoute("/posts")}
          className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" /> 返回广场
        </Link>
      </div>

      {pending && (isAuthor || isAdmin) ? (
        <Card>
          <CardContent className="pt-6 text-sm bg-amber-50 text-amber-900">
            <p>
              <strong>等待人工复核</strong>
              {" — "}内容暂时仅你和管理员可见。具体进度可在
              <Link href={toQueryRoute("/notifications")} className="underline ml-1">通知页面</Link>
              查看。
            </p>
          </CardContent>
        </Card>
      ) : null}

      {rejected && (isAuthor || isAdmin) ? (
        <Card>
          <CardContent className="pt-6 text-sm bg-rose-50 text-rose-900">
            <p>
              <strong>未通过审核</strong>。
              <Link href={toQueryRoute("/notifications")} className="underline ml-1">查看通知详情</Link>。
            </p>
          </CardContent>
        </Card>
      ) : null}

      {hidden && (isAuthor || isAdmin) ? (
        <Card>
          <CardContent className="pt-6 text-sm bg-ink/5 text-ink-muted">
            <p>该帖已被管理员或 AI 审核隐藏。</p>
          </CardContent>
        </Card>
      ) : null}

      {draft && isAuthor ? (
        <Card>
          <CardContent className="pt-6 text-sm bg-bg-muted text-ink-muted">
            <p>
              <strong>草稿</strong> — 只有你能看到。
              <Link href={toQueryRoute(`/posts/${post.id}/edit`)} className="underline ml-1">继续编辑</Link>
            </p>
          </CardContent>
        </Card>
      ) : null}

      <article className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {tags.length > 0 ? (
            tags.map((t) => (
              <Badge key={t} variant="pink">
                {TAG_LABEL[t] ?? t}
              </Badge>
            ))
          ) : (
            <Badge variant="outline">动态</Badge>
          )}
          {post.section === "MEDICAL" && post.hospital ? (
            <Badge variant="outline">{post.hospital}</Badge>
          ) : null}
        </div>
        <h1 className="font-serif text-display tracking-tight">{post.title}</h1>
        <div className="text-sm text-ink-subtle flex items-center gap-3 flex-wrap">
          <Link
            href={toQueryRoute(`/u/${post.author_handle}`)}
            className="text-ink font-medium hover:underline"
          >
            {post.author_name}
          </Link>
          <span>· {relativeTime(new Date(post.created_at))}</span>
          {user && !isAuthor ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSubscribe}
              className="text-xs h-7 px-2"
            >
              {post.subscribed ? (
                <><UserMinus className="h-3.5 w-3.5" /> 已关注</>
              ) : (
                <><UserPlus className="h-3.5 w-3.5" /> 关注作者</>
              )}
            </Button>
          ) : null}
        </div>
        <div className="prose-trans text-base leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {post.body}
          </ReactMarkdown>
        </div>

        {/* Action bar — like / bookmark / report / edit / delete */}
        <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-border">
          {user ? (
            <>
              <Button
                variant={post.liked ? "default" : "ghost"}
                size="sm"
                onClick={toggleLike}
                className="gap-1.5"
              >
                <Heart className={"h-4 w-4 " + (post.liked ? "fill-current" : "")} />
                {post.likeCount ?? 0}
              </Button>
              <Button
                variant={post.bookmarked ? "default" : "ghost"}
                size="sm"
                onClick={toggleBookmark}
                className="gap-1.5"
              >
                <Bookmark className={"h-4 w-4 " + (post.bookmarked ? "fill-current" : "")} />
                {post.bookmarked ? "已收藏" : "收藏"}
              </Button>
            </>
          ) : null}
          <div className="flex-1" />
          {!isAuthor && user ? (
            <ReportButton targetType="POST" targetId={post.id} />
          ) : null}
          {(isAuthor || isAdmin) ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href={toQueryRoute(`/posts/${post.id}/edit`)}>
                  <Pencil className="h-4 w-4" /> 编辑
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={remove}>
                <Trash2 className="h-4 w-4" /> 删除
              </Button>
            </>
          ) : null}
        </div>
      </article>

      {post.status === "PUBLISHED" ? <CommentSection postId={post.id} /> : null}
    </div>
  );
}

export default function PostDetailPage() {
  return (
    <Suspense>
      <PostDetailInner />
    </Suspense>
  );
}
