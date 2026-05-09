import Link from "next/link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TierBadge } from "@/components/user/TierBadge";
import { UserActions } from "./UserActions";
import { formatDate } from "@/lib/utils";
import type { UserTier, UserStatus } from "@/lib/enums";

export const metadata = { title: "用户管理" };

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim();
  const users = await db.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q } },
            { handle: { contains: q.toLowerCase() } },
            { displayName: { contains: q } },
          ],
        }
      : {},
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="管理后台" title="用户管理" />
      <form action="/admin/users" className="flex gap-2">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="搜索 email / handle / 昵称"
          className="max-w-sm"
        />
      </form>
      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/u/${u.handle}`}
                    className="font-medium hover:text-trans-blue-deep"
                  >
                    {u.displayName}
                  </Link>
                  <span className="text-xs text-ink-subtle">@{u.handle}</span>
                  <TierBadge tier={u.tier} />
                  {u.status !== "ACTIVE" ? (
                    <Badge variant="danger">
                      {u.status === "SUSPENDED" ? "封禁" : "已删除"}
                    </Badge>
                  ) : null}
                </div>
                <div className="text-xs text-ink-subtle">
                  {u.email} · 加入 {formatDate(u.createdAt)}
                </div>
              </div>
              <UserActions
                userId={u.id}
                currentTier={u.tier as UserTier}
                status={u.status as UserStatus}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
