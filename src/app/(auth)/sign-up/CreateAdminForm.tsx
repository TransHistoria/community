"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createAdminSchema } from "@/lib/validators/auth";

export function CreateAdminForm() {
  const [email, setEmail] = React.useState("");
  const [secret, setSecret] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = createAdminSchema.safeParse({ email: email.trim(), secret: secret.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "校验失败");
      return;
    }

    setPending(true);
    try {
      await api.auth.createAdmin(parsed.data.email, parsed.data.secret);
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "初始化失败";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-2">
        <p className="text-sm font-medium">管理员初始化成功，登录链接已发送到邮箱</p>
        <p className="text-xs text-ink-subtle">如果未收到邮件，请检查收件箱或稍后重试。</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="admin-email">邮箱</Label>
        <Input
          id="admin-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="create-admin-secret">初始化密钥</Label>
        <Input
          id="create-admin-secret"
          type="password"
          autoComplete="off"
          placeholder="CREATE_ADMIN"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          disabled={pending}
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "初始化中..." : "初始化管理员并发送登录链接"}
      </Button>
    </form>
  );
}
