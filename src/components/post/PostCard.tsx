import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Heart } from "lucide-react";
import type { Post } from "@/lib/api";
import { relativeTime } from "@/lib/utils";
import { toQueryRoute } from "@/lib/query-routing";
import { TAG_LABEL, parsePostTags } from "@/lib/post-tags";

type CardPost = Post & { like_count?: number };

export function PostCard({ post }: { post: CardPost }) {
  const isPending = post.status === "PENDING_REVIEW";
  const isHidden = post.status === "HIDDEN";
  const isRejected = post.status === "REJECTED";
  const isDraft = post.status === "DRAFT";
  const tags = parsePostTags(post.tags);
  // The list endpoint exposes `like_count` (snake_case); the detail endpoint
  // exposes `likeCount` (camelCase). Read both so the card works in either
  // context (list views, bookmarks, drafts).
  const likeCount = post.like_count ?? post.likeCount ?? 0;

  return (
    <Link href={toQueryRoute(`/posts/${post.id}`)} className="block group">
      <Card className="h-full transition-all group-hover:shadow-lift group-hover:-translate-y-0.5">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {tags.length > 0 ? (
              tags.slice(0, 3).map((t) => (
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
            {isDraft ? <Badge variant="outline">草稿</Badge> : null}
            {isPending ? <Badge variant="warn">等待复核</Badge> : null}
            {isRejected ? <Badge variant="danger">已拒绝</Badge> : null}
            {isHidden ? <Badge variant="outline">已隐藏</Badge> : null}
          </div>
          <h3 className="font-serif text-h3 leading-tight tracking-tight line-clamp-2">
            {post.title}
          </h3>
          <p className="text-sm text-ink-muted line-clamp-3 whitespace-pre-wrap">{post.body}</p>
          <div className="flex items-center justify-between text-xs text-ink-subtle pt-2 border-t border-border">
            <span className="min-w-0 truncate">
              <span className="text-ink">{post.author_name}</span>
              <span className="mx-1">·</span>
              {relativeTime(new Date(post.created_at))}
            </span>
            <span className="flex items-center gap-3 flex-none">
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" /> {likeCount}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="h-3 w-3" /> {post.comment_count ?? 0}
              </span>
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
