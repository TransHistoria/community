import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canComment } from "@/lib/access";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CommentForm } from "./CommentForm";
import { HideCommentButton } from "./HideCommentButton";
import { ReportButton } from "@/components/moderation/ReportButton";
import { ProfileMarkdown } from "@/components/user/ProfileMarkdown";
import { relativeTime } from "@/lib/utils";
import Link from "next/link";

export async function CommentSection({ eventId }: { eventId: string }) {
  const viewer = await getCurrentUser();
  if (!viewer) return null;

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true },
  });

  // Hidden comments + comments by users I've blocked / who blocked me are filtered.
  const myBlocks = await db.block.findMany({
    where: { OR: [{ blockerId: viewer.id }, { blockedId: viewer.id }] },
  });
  const blockedIds = myBlocks.map((b) =>
    b.blockerId === viewer.id ? b.blockedId : b.blockerId,
  );

  const comments = await db.comment.findMany({
    where: {
      eventId,
      isHidden: false,
      authorId: { notIn: blockedIds.length ? blockedIds : ["__none__"] },
      parentId: null,
    },
    include: {
      author: {
        select: { handle: true, displayName: true, avatarUrl: true, tier: true },
      },
      replies: {
        where: {
          isHidden: false,
          authorId: { notIn: blockedIds.length ? blockedIds : ["__none__"] },
        },
        include: {
          author: {
            select: {
              handle: true,
              displayName: true,
              avatarUrl: true,
              tier: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <section className="space-y-3" id="comments">
      <h2 className="font-serif text-h2 tracking-tight">讨论</h2>
      <p className="text-xs text-ink-subtle">
        所有讨论都是公开的——本平台没有私信。请在评论中保持尊重，敏感问题可在审核后的联系方式下沟通。
      </p>
      {canComment(viewer) ? (
        <CommentForm eventId={eventId} />
      ) : (
        <p className="text-sm text-ink-muted">
          完成认证后才能评论。
        </p>
      )}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-ink-muted">还没有评论。</p>
        ) : (
          comments.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-5 space-y-3">
                <CommentBody
                  comment={c}
                  viewerId={viewer.id}
                  organizerId={event?.organizerId ?? ""}
                  isAdmin={viewer.tier === "ADMIN"}
                />
                {c.replies.length > 0 ? (
                  <div className="ml-6 pl-4 border-l border-border space-y-3">
                    {c.replies.map((r) => (
                      <CommentBody
                        key={r.id}
                        comment={r}
                        viewerId={viewer.id}
                        organizerId={event?.organizerId ?? ""}
                        isAdmin={viewer.tier === "ADMIN"}
                      />
                    ))}
                  </div>
                ) : null}
                <CommentForm eventId={eventId} parentId={c.id} compact />
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}

function CommentBody({
  comment,
  viewerId,
  organizerId,
  isAdmin,
}: {
  comment: {
    id: string;
    body: string;
    createdAt: Date;
    authorId: string;
    author: {
      handle: string;
      displayName: string;
      avatarUrl: string | null;
      tier: string;
    };
  };
  viewerId: string;
  organizerId: string;
  isAdmin: boolean;
}) {
  const canHide = isAdmin || organizerId === viewerId;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/u/${comment.author.handle}`}
          className="flex items-center gap-2 group"
        >
          <Avatar className="h-8 w-8">
            {comment.author.avatarUrl ? (
              <AvatarImage src={comment.author.avatarUrl} alt="" />
            ) : null}
            <AvatarFallback className="text-xs">
              {comment.author.displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="text-sm">
            <span className="font-medium group-hover:text-trans-blue-deep">
              {comment.author.displayName}
            </span>
            <span className="text-ink-subtle"> · {relativeTime(comment.createdAt)}</span>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          {canHide ? <HideCommentButton commentId={comment.id} /> : null}
          {comment.authorId !== viewerId ? (
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
