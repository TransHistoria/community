"use client";
import * as React from "react";
import { signIn } from "next-auth/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signUpInviteSchema } from "@/lib/validators/auth";
import { consumeInvitePreCheck } from "./actions";

export function InviteSignUpForm() {
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = signUpInviteSchema.safeParse({ email: email.trim(), code: code.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "校验失败");
      return;
    }
    setPending(true);
    const res = await consumeInvitePreCheck(parsed.data);
    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }
    await signIn("email", {
      email: parsed.data.email,
      callbackUrl: "/me/profile?onboarding=1",
      redirect: true,
    });
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
