"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) router.replace("/sign-in");
      else if (user.tier !== "ADMIN") router.replace("/");
    }
  }, [user, loading, router]);

  if (loading || !user || user.tier !== "ADMIN") return null;

  return (
    <AppShell>
      <div className="grid gap-8 md:grid-cols-[200px_1fr]">
        <aside className="space-y-1 text-sm">
          <div className="text-xs uppercase tracking-wider text-ink-subtle mb-3">
            管理后台
          </div>
          <Link href="/admin/applications" className="block rounded-md px-3 py-2 text-ink-muted hover:bg-bg-muted hover:text-ink">申请审核</Link>
          <Link href="/admin/reports" className="block rounded-md px-3 py-2 text-ink-muted hover:bg-bg-muted hover:text-ink">举报队列</Link>
          <Link href="/admin/users" className="block rounded-md px-3 py-2 text-ink-muted hover:bg-bg-muted hover:text-ink">用户管理</Link>
          <Link href="/admin/audit" className="block rounded-md px-3 py-2 text-ink-muted hover:bg-bg-muted hover:text-ink">操作日志</Link>
        </aside>
        <div>{children}</div>
      </div>
    </AppShell>
  );
}
