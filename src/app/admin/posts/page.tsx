"use client";

import * as React from "react";
import Link from "next/link";
import { api, type Post } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { useToast } from "@/components/ui/toast-context";
import { PageHeader } from "@/components/ui/page-header";
import { POST_SECTION_LABEL, type PostSection } from "@/lib/enums";
import { toQueryRoute } from "@/lib/query-routing";
import { relativeTime } from "@/lib/utils";

export default function AdminPostsPage() {
  const { toast } = useToast();
  const [posts, setPosts] = React.useState<Post[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(() => {
    setLoading(true);
    api.admin
      .listPendingPosts()
      .then((res) => setPosts(res.posts))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function decide(id: string, decision: "APPROVE" | "REJECT" | "HIDE") {
    try {
      await api.admin.reviewPost(id, decision);
      toast({
        title:
          decision === "APPROVE" ? "已放行" : decision === "REJECT" ? "已拒绝" : "已隐藏",
        variant: "success",
      });
      refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "操作失败";
      toast({ title: "操作失败", description: msg, variant: "danger" });
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="管理"
        title="帖子复核队列"
        description={`待复核帖子 ${posts.length} 条。LLM 标记的边界内容在此等待你的决定。`}
      />

      {loading ? (
        <p className="text-sm text-ink-muted">加载中…</p>
      ) : posts.length === 0 ? (
        <EmptyState title="队列为空" description="所有 PENDING_REVIEW 的帖子都已处理。" />
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <Badge variant="pink">{POST_SECTION_LABEL[p.section as PostSection]}</Badge>
                  <Badge variant="warn">PENDING_REVIEW</Badge>
                  <span className="text-ink-subtle">
                    {p.author_name} · {relativeTime(new Date(p.created_at))}
                  </span>
                </div>
                <Link
                  href={toQueryRoute(`/posts/${p.id}`)}
                  className="block font-serif text-h3 hover:underline"
                >
                  {p.title}
                </Link>
                <p className="text-sm text-ink-muted whitespace-pre-wrap line-clamp-6">{p.body}</p>
                {p.moderation_reason ? (
                  <div className="text-xs text-ink-subtle border-t border-border pt-3">
                    AI 判断:<span className="text-ink">{p.moderation_verdict}</span> ·{" "}
                    {p.moderation_reason}
                    {p.moderation_categories && p.moderation_categories !== "[]" ? (
                      <> · 标签:{p.moderation_categories}</>
                    ) : null}
                  </div>
                ) : null}
                <div className="flex justify-end gap-2 pt-3 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => decide(p.id, "HIDE")}>
                    隐藏
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => decide(p.id, "REJECT")}>
                    拒绝
                  </Button>
                  <Button size="sm" onClick={() => decide(p.id, "APPROVE")}>
                    放行
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
