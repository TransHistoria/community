"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signUpInviteSchema } from "@/lib/validators/auth";

export function InviteSignUpForm() {
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = signUpInviteSchema.safeParse({ email: email.trim(), code: code.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "校验失败");
      return;
    }
    setPending(true);
    try {
      await api.auth.verifyInvite(parsed.data.email, parsed.data.code);
      await api.auth.sendLink(parsed.data.email);
      setSent(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "校验失败，请检查邀请码";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-2">
        <p className="text-sm font-medium">登录链接已发送到你的邮箱</p>
        <p className="text-xs text-ink-subtle">链接 30 分钟内有效，仅限一次。</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
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
        <Label htmlFor="code">邀请码</Label>
        <Input
          id="code"
          type="text"
          autoComplete="off"
          placeholder="例如 K7H3M9N2"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          disabled={pending}
          className="font-mono tracking-widest"
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? "校验中..." : "校验并发送登录链接"}
      </Button>
    </form>
  );
}
