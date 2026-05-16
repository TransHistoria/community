"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Trash2, ArrowLeft } from "lucide-react";
import { api, type Post } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CommentSection } from "@/components/post/CommentSection";
import { useToast } from "@/components/ui/toast-context";
import {
  POST_SECTION_LABEL,
  POST_STATUS_LABEL,
  RESOURCE_KIND_LABEL,
  type PostSection,
  type PostStatus,
  type ResourceKind,
} from "@/lib/enums";
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
              {" — "}AI 标记此内容需要管理员确认。当前仅你本人和管理员可见。
            </p>
            {post.moderation_reason ? <p className="mt-1 text-xs">原因:{post.moderation_reason}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {rejected && (isAuthor || isAdmin) ? (
        <Card>
          <CardContent className="pt-6 text-sm bg-rose-50 text-rose-900">
            <p>
              <strong>已被拒绝</strong>{post.moderation_reason ? ` — ${post.moderation_reason}` : ""}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {hidden && (isAuthor || isAdmin) ? (
        <Card>
          <CardContent className="pt-6 text-sm bg-ink/5 text-ink-muted">
            <p>该帖已被管理员隐藏。</p>
          </CardContent>
        </Card>
      ) : null}

      <article className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant="pink">{POST_SECTION_LABEL[post.section as PostSection]}</Badge>
          {post.section === "RESOURCE" && post.resource_kind ? (
            <Badge variant="outline">
              {RESOURCE_KIND_LABEL[post.resource_kind as ResourceKind]}
            </Badge>
          ) : null}
          {post.section === "MEDICAL" && post.hospital ? (
            <Badge variant="outline">{post.hospital}</Badge>
          ) : null}
          {post.status !== "PUBLISHED" ? (
            <Badge variant="warn">{POST_STATUS_LABEL[post.status as PostStatus]}</Badge>
          ) : null}
        </div>
        <h1 className="font-serif text-display tracking-tight">{post.title}</h1>
        <div className="text-sm text-ink-subtle">
          <Link
            href={toQueryRoute(`/u/${post.author_handle}`)}
            className="text-ink font-medium hover:underline"
          >
            {post.author_name}
          </Link>{" "}
          · {relativeTime(new Date(post.created_at))}
        </div>
        <div className="prose-trans whitespace-pre-wrap text-base leading-relaxed">{post.body}</div>

        {(isAuthor || isAdmin) ? (
          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button variant="ghost" size="sm" onClick={remove}>
              <Trash2 className="h-4 w-4" /> 删除
            </Button>
          </div>
        ) : null}
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
