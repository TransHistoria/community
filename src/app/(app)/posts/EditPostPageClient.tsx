"use client";

import * as React from "react";
import { Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, type Post } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canEditPost } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { PostForm } from "@/components/post/PostForm";
import { getQueryRoute, toQueryRoute } from "@/lib/query-routing";

function EditPostInner() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const queryRoutePath = React.useMemo(() => getQueryRoute(searchParams).path, [searchParams]);
  const queryId = React.useMemo(() => {
    const match = queryRoutePath.match(/^\/posts\/([^/]+)\/edit$/);
    return match?.[1];
  }, [queryRoutePath]);
  const id = params?.id ?? queryId;
  const { user, loading } = useAuth();
  const router = useRouter();
  const [post, setPost] = React.useState<Post | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    api.posts
      .get(id)
      .then((res) => setPost(res.post))
      .catch(() => setNotFound(true));
  }, [id]);

  if (loading) return null;
  if (!user) {
    router.replace(toQueryRoute(`/sign-in?callbackUrl=/posts/${id}/edit`));
    return null;
  }
  if (notFound) {
    return (
      <EmptyState
        title="帖子不存在"
        description="可能已被删除或你无权访问。"
      />
    );
  }
  if (!post || !id) return null;

  if (!canEditPost(user, post)) {
    return (
      <EmptyState
        title="无权编辑此帖"
        description="只有原作者和管理员可以编辑。"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="编辑"
        title={`编辑「${post.title}」`}
        description="重新提交后会再次经过 AI 审核。如果改动很大,新的归类可能会不同。"
      />
      <PostForm
        mode="edit"
        postId={id}
        initial={{
          title: post.title,
          body: post.body,
          visibility: post.visibility,
          status: post.status,
        }}
      />
    </div>
  );
}

export default function EditPostPageClient() {
  return (
    <Suspense>
      <EditPostInner />
    </Suspense>
  );
}
