"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailSchema, signInTotpSchema } from "@/lib/validators/auth";

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [setupSent, setSetupSent] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = signInTotpSchema.safeParse({
      email: email.trim(),
      code: code.trim(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "邮箱格式不正确");
      return;
    }
    setPending(true);
    try {
      const res = await api.auth.loginTotp(parsed.data.email, parsed.data.code);
      localStorage.setItem("tc_token", res.token);
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("登录失败，请检查邮箱和验证码。");
    } finally {
      setPending(false);
    }
  }

  async function onSendSetup() {
    setError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "邮箱格式不正确");
      return;
    }
    setPending(true);
    try {
      await api.auth.registerTotp(parsed.data);
      setSetupSent(true);
    } catch {
      setError("发送失败，请稍后重试。");
    } finally {
      setPending(false);
    }
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
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="totp">TOTP 验证码</Label>
        <Input
          id="totp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6 位验证码"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={pending}
        />
      </div>
      {setupSent ? (
        <p className="text-xs text-ink-subtle">TOTP 初始化邮件已发送，请查收并扫码后登录。</p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} size="lg">
        {pending ? "登录中..." : "使用 TOTP 登录"}
      </Button>
      <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={onSendSetup}>
        {pending ? "处理中..." : "发送/重置 TOTP 初始化邮件"}
      </Button>
      <p className="text-xs text-ink-subtle text-center leading-relaxed">
        我们不存储密码，登录使用认证器 6 位动态验证码。
      </p>
    </form>
  );
}
