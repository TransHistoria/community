"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TurnstileWidget } from "@/components/security/TurnstileWidget";

export default function AdminSettingsPage() {
  const { user } = useAuth();
  const [to, setTo] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "sending" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = React.useState("");
  const turnstileEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = React.useState(0);
  const [turnstileStatus, setTurnstileStatus] = React.useState<"idle" | "testing" | "ok" | "error">("idle");
  const [turnstileMsg, setTurnstileMsg] = React.useState("");

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrMsg("");
    try {
      await api.admin.sendTestEmail(to.trim() || undefined);
      setStatus("ok");
    } catch (err) {
      setStatus("error");
      setErrMsg(err instanceof Error ? err.message : "发送失败");
    }
  }

  async function handleTestTurnstile(e: React.FormEvent) {
    e.preventDefault();
    setTurnstileStatus("testing");
    setTurnstileMsg("");
    try {
      const res = await api.admin.testTurnstile(turnstileToken ?? undefined);
      setTurnstileStatus("ok");
      setTurnstileMsg(
        res.enforced === false
          ? (res.message ?? "Turnstile 未启用（未配置 TURNSTILE_SECRET_KEY）")
          : "Turnstile 校验成功",
      );
    } catch (err) {
      setTurnstileStatus("error");
      setTurnstileMsg(err instanceof Error ? err.message : "Turnstile 测试失败");
      setTurnstileResetSignal((v) => v + 1);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="管理后台" title="系统设置" description="测试系统功能是否正常运作。" />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <h3 className="font-semibold mb-1">发送测试邮件</h3>
            <p className="text-sm text-ink-muted mb-4">
              向指定地址发送一封测试邮件，验证邮件服务配置是否正常。默认发送至你自己的邮箱（
              <span className="font-mono text-xs">{user?.email}</span>）。
            </p>
          </div>

          <form onSubmit={handleSend} className="flex gap-2 flex-wrap">
            <Input
              type="email"
              placeholder={user?.email ?? "收件地址（留空则发至自己）"}
              value={to}
              onChange={(e) => { setTo(e.target.value); setStatus("idle"); }}
              className="max-w-sm"
            />
            <Button type="submit" disabled={status === "sending"}>
              {status === "sending" ? "发送中…" : "发送测试邮件"}
            </Button>
          </form>

          {status === "ok" && (
            <p className="text-sm text-green-600">✓ 测试邮件已发出，请检查收件箱。</p>
          )}
          {status === "error" && (
            <p className="text-sm text-red-500">✗ {errMsg}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <h3 className="font-semibold mb-1">测试 Turnstile</h3>
            <p className="text-sm text-ink-muted mb-4">
              验证前端 site key 与 Worker 端 TURNSTILE_SECRET_KEY 是否配置正确。
            </p>
          </div>

          <form onSubmit={handleTestTurnstile} className="space-y-3">
            {turnstileEnabled ? (
              <TurnstileWidget onTokenChange={setTurnstileToken} resetSignal={turnstileResetSignal} />
            ) : (
              <p className="text-sm text-ink-muted">
                未检测到 TURNSTILE_SITE_KEY（构建时注入），可直接测试 Worker 端配置状态。
              </p>
            )}
            <Button
              type="submit"
              disabled={turnstileStatus === "testing" || (turnstileEnabled && !turnstileToken)}
            >
              {turnstileStatus === "testing" ? "测试中…" : "测试 Turnstile"}
            </Button>
          </form>

          {turnstileStatus === "ok" && (
            <p className="text-sm text-green-600">✓ {turnstileMsg}</p>
          )}
          {turnstileStatus === "error" && (
            <p className="text-sm text-red-500">✗ {turnstileMsg}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
