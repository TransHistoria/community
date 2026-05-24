"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { api, type Post } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast-context";
import { relativeTime } from "@/lib/utils";
import { toQueryRoute } from "@/lib/query-routing";

export default function MyDraftsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  const reload = React.useCallback(() => {
    api.posts
      .myDrafts()
      .then((res) => setPosts(res.posts))
      .catch(() => setPosts([]))
      .finally(() => setLoaded(true));
  }, []);

  React.useEffect(() => {
    if (!loading && !user) router.replace(toQueryRoute("/sign-in?callbackUrl=/me/drafts"));
  }, [loading, user, router]);

  React.useEffect(() => {
    if (user) reload();
  }, [user, reload]);

  async function remove(id: string) {
    if (!confirm("删除这条草稿？")) return;
    try {
      await api.posts.remove(id);
      toast({ title: "已删除", variant: "success" });
      reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "删除失败";
      toast({ title: "删除失败", description: msg, variant: "danger" });
    }
  }

  if (loading || !user) return null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="我"
        title="草稿箱"
        description="还没准备好发布的内容。点击编辑继续写,准备好后再点发布。"
      />
      {!loaded ? (
        <p className="text-sm text-ink-muted">加载中…</p>
      ) : posts.length === 0 ? (
        <EmptyState
          title="草稿箱是空的"
          description="发帖时点「存为草稿」就会出现在这里。"
        />
      ) : (
        <div className="space-y-3">
          {posts.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              {/* Whole card body links to the edit page — draft detail is gated by status. */}
              <Link
                href={toQueryRoute(`/posts/${p.id}/edit`)}
                className="block hover:bg-bg-muted/30 transition-colors"
              >
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-h3 truncate">{p.title || "(未命名)"}</p>
                      <p className="text-sm text-ink-muted line-clamp-2 mt-1 whitespace-pre-wrap">
                        {p.body || "(空草稿)"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-ink-subtle pt-2 border-t border-border">
                    <span>更新于 {relativeTime(new Date(p.updated_at))}</span>
                    <span className="inline-flex items-center gap-1 text-ink-muted">
                      <Pencil className="h-3 w-3" /> 点击继续编辑
                    </span>
                  </div>
                </CardContent>
              </Link>
              <div className="flex justify-end px-5 pb-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(p.id)}
                  className="text-ink-subtle hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> 删除草稿
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
