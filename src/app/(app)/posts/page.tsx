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
import { TAG_TABS, parsePostTags } from "@/lib/post-tags";
import { getQueryRoute, toQueryRoute } from "@/lib/query-routing";

function PostsListInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const queryRoute = React.useMemo(() => getQueryRoute(searchParams), [searchParams]);
  const isLiteralPostsRoute = queryRoute.path === "/posts" || queryRoute.path.startsWith("/posts/");
  const routeParams = isLiteralPostsRoute ? queryRoute.params : searchParams;
  const activeTab = routeParams.get("tab") ?? "all";
  const q = routeParams.get("q") ?? undefined;

  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loadFailed, setLoadFailed] = React.useState(false);

  React.useEffect(() => {
    const tabConfig = TAG_TABS.find((t) => t.key === activeTab);
    // For tabs whose tag is a prefix (e.g. "medical-"), fetch a broader set
    // and filter client-side; for exact-match tabs use the API tag filter.
    const params: { tag?: string; q?: string } = q ? { q } : {};
    if (tabConfig?.tag && !tabConfig.tag.endsWith("-")) {
      params.tag = tabConfig.tag;
    }
    api.posts
      .list(params)
      .then((res) => {
        let list = res.posts;
        if (tabConfig?.tag && tabConfig.tag.endsWith("-")) {
          const prefix = tabConfig.tag;
          list = list.filter((p) =>
            parsePostTags(p.tags).some((t) => t.startsWith(prefix)),
          );
        }
        setPosts(list);
        setLoadFailed(false);
      })
      .catch(() => {
        setPosts([]);
        setLoadFailed(true);
      });
  }, [activeTab, q]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="广场"
        title="动态、医疗、资源,都在这里"
        description="任何认证成员都可以发帖。系统会自动审核和分类,你只需要把话说清楚。"
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
        {TAG_TABS.map((tab) => (
          <FilterPill
            key={tab.key}
            href={toQueryRoute(tab.key === "all" ? "/posts" : `/posts?tab=${tab.key}`)}
            active={activeTab === tab.key}
          >
            {tab.label}
          </FilterPill>
        ))}
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title={loadFailed ? "加载失败" : "这里还很安静"}
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
