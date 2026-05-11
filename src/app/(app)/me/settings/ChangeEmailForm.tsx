"use client";

import * as React from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ChangeEmailForm() {
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setPending(true);
    try {
      await api.auth.changeEmail(email.trim(), code.trim());
      setMessage("邮箱已更新");
      setEmail("");
      setCode("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "更新失败");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="new-email">新邮箱</Label>
        <Input
          id="new-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email-change-code">当前 TOTP 验证码</Label>
        <Input
          id="email-change-code"
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          disabled={pending}
        />
      </div>
      {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "更新中..." : "更新邮箱"}
      </Button>
    </form>
  );
}
