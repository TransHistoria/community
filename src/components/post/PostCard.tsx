import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Building2, HandHelping, Sparkles } from "lucide-react";
import type { Post } from "@/lib/api";
import {
  POST_SECTION_LABEL,
  RESOURCE_KIND_LABEL,
  type PostSection,
  type ResourceKind,
} from "@/lib/enums";
import { relativeTime } from "@/lib/utils";
import { toQueryRoute } from "@/lib/query-routing";

const SECTION_ICON: Record<PostSection, React.ComponentType<{ className?: string }>> = {
  POST: Sparkles,
  MEDICAL: Building2,
  RESOURCE: HandHelping,
};

export function PostCard({ post }: { post: Post }) {
  const Icon = SECTION_ICON[post.section];
  const isPending = post.status === "PENDING_REVIEW";
  const isHidden = post.status === "HIDDEN";
  const isRejected = post.status === "REJECTED";

  return (
    <Link href={toQueryRoute(`/posts/${post.id}`)} className="block group">
      <Card className="h-full transition-all group-hover:shadow-lift group-hover:-translate-y-0.5">
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <Badge variant="pink" className="gap-1">
              <Icon className="h-3 w-3" /> {POST_SECTION_LABEL[post.section]}
            </Badge>
            {post.section === "RESOURCE" && post.resource_kind ? (
              <Badge variant="outline">
                {RESOURCE_KIND_LABEL[post.resource_kind as ResourceKind]}
              </Badge>
            ) : null}
            {post.section === "MEDICAL" && post.hospital ? (
              <Badge variant="outline">{post.hospital}</Badge>
            ) : null}
            {isPending ? <Badge variant="warn">等待复核</Badge> : null}
            {isRejected ? <Badge variant="danger">已拒绝</Badge> : null}
            {isHidden ? <Badge variant="outline">已隐藏</Badge> : null}
          </div>
          <h3 className="font-serif text-h3 leading-tight tracking-tight line-clamp-2">
            {post.title}
          </h3>
          <p className="text-sm text-ink-muted line-clamp-3 whitespace-pre-wrap">{post.body}</p>
          <div className="flex items-center justify-between text-xs text-ink-subtle pt-2 border-t border-border">
            <span>
              <span className="text-ink">{post.author_name}</span>
              <span className="mx-1">·</span>
              {relativeTime(new Date(post.created_at))}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="h-3 w-3" /> {post.comment_count ?? 0}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
