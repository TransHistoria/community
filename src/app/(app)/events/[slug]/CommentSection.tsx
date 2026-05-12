"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canComment, canHideComment } from "@/lib/access";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CommentForm } from "./CommentForm";
import { HideCommentButton } from "./HideCommentButton";
import { ReportButton } from "@/components/moderation/ReportButton";
import { ProfileMarkdown } from "@/components/user/ProfileMarkdown";
import { relativeTime } from "@/lib/utils";
import Link from "next/link";
import { toQueryRoute } from "@/lib/query-routing";

type ApiComment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  is_hidden?: boolean;
  author_handle: string;
  author_name: string;
  author_avatar?: string | null;
  author_tier: string;
  parent_id?: string | null;
  replies?: ApiComment[];
  event_organizer_id?: string;
};

function CommentBody({
  comment,
  viewerId,
  organizerId,
  isAdmin,
  onHidden,
}: {
  comment: ApiComment;
  viewerId: string;
  organizerId: string;
  isAdmin: boolean;
  onHidden: () => void;
}) {
  const canHide = isAdmin || organizerId === viewerId;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Link href={toQueryRoute(`/u/${comment.author_handle}`)} className="flex items-center gap-2 group">
          <Avatar className="h-8 w-8">
            {comment.author_avatar ? <AvatarImage src={comment.author_avatar} alt="" /> : null}
            <AvatarFallback className="text-xs">{comment.author_name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <span className="font-medium group-hover:text-trans-blue-deep">{comment.author_name}</span>
            <span className="text-ink-subtle"> · {relativeTime(new Date(comment.created_at))}</span>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          {canHide ? <HideCommentButton commentId={comment.id} onHidden={onHidden} /> : null}
          {comment.author_id !== viewerId ? (
            <ReportButton targetType="COMMENT" targetId={comment.id} />
          ) : null}
        </div>
      </div>
      <div className="text-sm prose-trans">
        <ProfileMarkdown source={comment.body} />
      </div>
    </div>
  );
}

export function CommentSection({ eventId }: { eventId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = React.useState<ApiComment[]>([]);

  function loadComments() {
    api.events.listComments(eventId).then((res: { comments: unknown[] }) => {
      setComments(res.comments as ApiComment[]);
    });
  }

  React.useEffect(() => { loadComments(); }, [eventId]);

  if (!user) return null;

  const organizerId = comments[0]?.event_organizer_id ?? "";
  const isAdmin = user.tier === "ADMIN";
  const topLevel = comments.filter((c) => !c.parent_id);

  return (
    <section className="space-y-3" id="comments">
      <h2 className="font-serif text-h2 tracking-tight">讨论</h2>
      <p className="text-xs text-ink-subtle">
        所有讨论都是公开的——本平台没有私信。请在评论中保持尊重，敏感问题可在审核后的联系方式下沟通。
      </p>
      {canComment(user) ? (
        <CommentForm eventId={eventId} onPosted={loadComments} />
      ) : (
        <p className="text-sm text-ink-muted">完成认证后才能评论。</p>
      )}
      <div className="space-y-3">
        {topLevel.length === 0 ? (
          <p className="text-sm text-ink-muted">还没有评论。</p>
        ) : (
          topLevel.map((c) => {
            const replies = comments.filter((r) => r.parent_id === c.id);
            return (
              <Card key={c.id}>
                <CardContent className="pt-5 space-y-3">
                  <CommentBody
                    comment={c}
                    viewerId={user.id}
                    organizerId={organizerId}
                    isAdmin={isAdmin}
                    onHidden={loadComments}
                  />
                  {replies.length > 0 ? (
                    <div className="ml-6 pl-4 border-l border-border space-y-3">
                      {replies.map((r) => (
                        <CommentBody
                          key={r.id}
                          comment={r}
                          viewerId={user.id}
                          organizerId={organizerId}
                          isAdmin={isAdmin}
                          onHidden={loadComments}
                        />
                      ))}
                    </div>
                  ) : null}
                  <CommentForm eventId={eventId} parentId={c.id} compact onPosted={loadComments} />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </section>
  );
}
