"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { canCreatePost } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { PostForm } from "@/components/post/PostForm";
import { toQueryRoute } from "@/lib/query-routing";

function NewPostInner() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) return null;
  if (!user) {
    router.replace(toQueryRoute("/sign-in?callbackUrl=/posts/new"));
    return null;
  }
  if (!canCreatePost(user)) {
    return (
      <EmptyState
        title="需要完成认证后才能发帖"
        description="完成入站申请或使用邀请码激活成为认证成员。"
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="发帖"
        title="发布到广场"
        description="选择板块,正文支持 Markdown。提交后内容会经过 AI 审核;违规会被退回,边界内容会进入人工复核。"
      />
      <PostForm mode="create" />
    </div>
  );
}

export default function NewPostPage() {
  return (
    <Suspense>
      <NewPostInner />
    </Suspense>
  );
}
