"use client";
import * as React from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailSchema } from "@/lib/validators/auth";

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "邮箱格式不正确");
      return;
    }
    setPending(true);
    try {
      await signIn("email", {
        email: parsed.data,
        callbackUrl,
        redirect: true,
      });
    } catch {
      setError("发送失败，请稍后重试。");
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
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending} size="lg">
        {pending ? "正在发送..." : "发送登录链接"}
      </Button>
      <p className="text-xs text-ink-subtle text-center leading-relaxed">
        登录链接 30 分钟内有效，仅限一次。我们不存储密码。
      </p>
    </form>
  );
}
