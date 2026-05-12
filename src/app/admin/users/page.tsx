"use client";
import * as React from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { TierBadge } from "@/components/user/TierBadge";
import { UserActions } from "./UserActions";
import { formatDate } from "@/lib/utils";
import { toQueryRoute } from "@/lib/query-routing";

type AdminUser = { id: string; handle: string; displayName: string; email: string; tier: string; status: string; created_at: string };

function AdminUsersInner() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [users, setUsers] = React.useState<AdminUser[]>([]);

  function load(query: string) {
    api.admin.listUsers({ q: query || undefined }).then((res: { users: unknown[] }) => setUsers(res.users as AdminUser[]));
  }

  React.useEffect(() => { load(q); }, [q]);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="管理后台" title="用户管理" />
      <form action="/admin/users" className="flex gap-2">
        <Input name="q" defaultValue={q} placeholder="搜索 email / handle / 昵称" className="max-w-sm" />
      </form>
      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id}>
            <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Link href={toQueryRoute(`/u/${u.handle}`)} className="font-medium hover:text-trans-blue-deep">{u.displayName}</Link>
                  <span className="text-xs text-ink-subtle">@{u.handle}</span>
                  <TierBadge tier={u.tier} />
                  {u.status !== "ACTIVE" ? (
                    <Badge variant="danger">{u.status === "SUSPENDED" ? "封禁" : "已删除"}</Badge>
                  ) : null}
                </div>
                <div className="text-xs text-ink-subtle">{u.email} · 加入 {formatDate(new Date(u.created_at))}</div>
              </div>
              <UserActions userId={u.id} currentTier={u.tier} status={u.status} onUpdated={() => load(q)} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return <Suspense><AdminUsersInner /></Suspense>;
}
