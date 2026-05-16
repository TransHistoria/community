"use client";

import * as React from "react";
import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { api, type Post } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canCreatePost } from "@/lib/access";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty";
import { PostCard } from "@/components/post/PostCard";
import { TAG_TABS, parsePostTags } from "@/lib/post-tags";
import { getQueryRoute, toQueryRoute } from "@/lib/query-routing";

const PAGE_SIZE = 30;

function PostsListInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryRoute = React.useMemo(() => getQueryRoute(searchParams), [searchParams]);
  const isLiteralPostsRoute = queryRoute.path === "/posts" || queryRoute.path.startsWith("/posts/");
  const routeParams = isLiteralPostsRoute ? queryRoute.params : searchParams;
  const activeTab = routeParams.get("tab") ?? "all";
  const initialQ = routeParams.get("q") ?? "";

  const [searchText, setSearchText] = React.useState(initialQ);
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [loadFailed, setLoadFailed] = React.useState(false);

  const tabConfig = React.useMemo(
    () => TAG_TABS.find((t) => t.key === activeTab),
    [activeTab],
  );

  const baseParams = React.useMemo(() => {
    const p: { tag?: string; q?: string; page?: number } = {};
    if (initialQ) p.q = initialQ;
    if (tabConfig?.tag && !tabConfig.tag.endsWith("-")) p.tag = tabConfig.tag;
    return p;
  }, [initialQ, tabConfig]);

  // Initial / filter-change load.
  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.posts
      .list({ ...baseParams, page: 1 })
      .then((res) => {
        if (cancelled) return;
        let list = res.posts;
        if (tabConfig?.tag && tabConfig.tag.endsWith("-")) {
          const prefix = tabConfig.tag;
          list = list.filter((p) => parsePostTags(p.tags).some((t) => t.startsWith(prefix)));
        }
        setPosts(list);
        setHasMore(!!res.hasMore);
        setPage(1);
        setLoadFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPosts([]);
        setHasMore(false);
        setLoadFailed(true);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [baseParams, tabConfig]);

  async function loadMore() {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const res = await api.posts.list({ ...baseParams, page: page + 1 });
      let list = res.posts;
      if (tabConfig?.tag && tabConfig.tag.endsWith("-")) {
        const prefix = tabConfig.tag;
        list = list.filter((p) => parsePostTags(p.tags).some((t) => t.startsWith(prefix)));
      }
      setPosts((prev) => [...prev, ...list]);
      setHasMore(!!res.hasMore);
      setPage(page + 1);
    } finally {
      setLoading(false);
    }
  }

  function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (activeTab !== "all") params.set("tab", activeTab);
    if (searchText.trim()) params.set("q", searchText.trim());
    const qs = params.toString();
    router.push(toQueryRoute(qs ? `/posts?${qs}` : "/posts"));
  }

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

      <form onSubmit={onSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-ink-subtle" />
          <Input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="搜索标题或正文…"
            className="pl-8"
          />
        </div>
        <Button type="submit" variant="outline">搜索</Button>
        {initialQ ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchText("");
              router.push(toQueryRoute(activeTab === "all" ? "/posts" : `/posts?tab=${activeTab}`));
            }}
          >
            清除
          </Button>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2">
        {TAG_TABS.map((tab) => {
          const params = new URLSearchParams();
          if (tab.key !== "all") params.set("tab", tab.key);
          if (initialQ) params.set("q", initialQ);
          const qs = params.toString();
          return (
            <FilterPill
              key={tab.key}
              href={toQueryRoute(qs ? `/posts?${qs}` : "/posts")}
              active={activeTab === tab.key}
            >
              {tab.label}
            </FilterPill>
          );
        })}
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title={loadFailed ? "加载失败" : initialQ ? `没找到匹配「${initialQ}」的帖子` : "这里还很安静"}
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
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
          {hasMore ? (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
                {loading ? "加载中…" : "加载更多"}
              </Button>
            </div>
          ) : null}
        </>
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
