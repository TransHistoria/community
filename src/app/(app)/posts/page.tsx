"use client";

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { api, type Post } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canCreatePost } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { PostCard } from "@/components/post/PostCard";
import { POST_SECTION_LABEL, type PostSection } from "@/lib/enums";
import { getQueryRoute, toQueryRoute } from "@/lib/query-routing";

const SECTIONS: PostSection[] = ["POST", "MEDICAL", "RESOURCE"];

function PostsListInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const queryRoute = React.useMemo(() => getQueryRoute(searchParams), [searchParams]);
  const isLiteralPostsRoute = queryRoute.path === "/posts" || queryRoute.path.startsWith("/posts/");
  const routeParams = isLiteralPostsRoute ? queryRoute.params : searchParams;
  const section = (routeParams.get("section") as PostSection | null) ?? null;
  const hospital = routeParams.get("hospital") ?? undefined;
  const q = routeParams.get("q") ?? undefined;

  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    api.posts
      .list({ section: section ?? undefined, hospital, q })
      .then((res) => {
        setPosts(res.posts);
        setLoadFailed(false);
      })
      .catch(() => {
        setPosts([]);
        setLoadFailed(true);
      });
  }, [section, hospital, q]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="广场"
        title="动态 · 医疗信息 · 资源分享"
        description="任何认证成员都可以在这里发帖。每条内容会经 AI 审核与人工复核。"
        actions={
          canCreatePost(user) ? (
            <Button asChild>
              <Link href={toQueryRoute("/posts/new")}>
                <Plus className="h-4 w-4" /> 发帖
              </Link>
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        <FilterPill href={toQueryRoute("/posts")} active={!section}>
          全部
        </FilterPill>
        {SECTIONS.map((s) => (
          <FilterPill key={s} href={toQueryRoute(`/posts?section=${s}`)} active={section === s}>
            {POST_SECTION_LABEL[s]}
          </FilterPill>
        ))}
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title={loadFailed ? "加载失败" : "暂无帖子"}
          description={
            loadFailed
              ? "请检查网络后重试。"
              : canCreatePost(user)
                ? "做第一个分享的人。"
                : "完成认证后即可发帖与评论。"
          }
          action={
            canCreatePost(user) ? (
              <Button asChild>
                <Link href={toQueryRoute("/posts/new")}>发个帖</Link>
              </Button>
            ) : null
          }
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

export default function PostsPage() {
  return (
    <Suspense>
      <PostsListInner />
    </Suspense>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        "rounded-full px-3 py-1.5 text-xs transition-colors " +
        (active
          ? "bg-trans-gradient text-white shadow-soft"
          : "border border-border bg-card text-ink-muted hover:text-ink")
      }
    >
      {children}
    </Link>
  );
}
