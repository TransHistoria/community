"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, type Post } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { PostCard } from "@/components/post/PostCard";
import { toQueryRoute } from "@/lib/query-routing";

export default function MyBookmarksPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user) router.replace(toQueryRoute("/sign-in?callbackUrl=/me/bookmarks"));
  }, [loading, user, router]);

  React.useEffect(() => {
    if (!user) return;
    api.posts
      .myBookmarks()
      .then((res) => setPosts(res.posts))
      .catch(() => setPosts([]))
      .finally(() => setLoaded(true));
  }, [user]);

  if (loading || !user) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="我"
        title="收藏的帖子"
        description="只有你能看到。已被作者删除或隐藏的帖子不会出现在这里。"
      />
      {!loaded ? (
        <p className="text-sm text-ink-muted">加载中…</p>
      ) : posts.length === 0 ? (
        <EmptyState
          title="还没有收藏"
          description="在帖子详情页点收藏按钮,这里就会显示。"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}
