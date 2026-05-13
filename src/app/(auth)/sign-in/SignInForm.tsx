"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { emailSchema, signInTotpSchema } from "@/lib/validators/auth";

type Tab = "password" | "totp";
type Step = "email" | "method";

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const { login } = useAuth();
  const [step, setStep] = React.useState<Step>("email");
  const [tab, setTab] = React.useState<Tab>("password");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [code, setCode] = React.useState("");
  const [requireBoth, setRequireBoth] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [resetSent, setResetSent] = React.useState(false);
  const [setupSent, setSetupSent] = React.useState(false);
  const [showForgot, setShowForgot] = React.useState(false);

  function errorMessage(err: unknown, fallback: string): string {
    return err instanceof Error && err.message ? err.message : fallback;
  }

  function onContinueWithEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "邮箱格式不正确");
      return;
    }
    setStep("method");
    setShowForgot(false);
    setRequireBoth(false);
    setPassword("");
    setCode("");
  }

  async function onSubmitPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("请填写邮箱和密码");
      return;
    }
    if (requireBoth && !code.trim()) {
      setError("你的账号要求同时提供 TOTP 验证码");
      return;
    }
    setPending(true);
    try {
      const res = await api.auth.loginPassword(
        email.trim(),
        password,
        requireBoth ? code.trim() : undefined,
      );
      login(res.token, res.user);
      router.push(callbackUrl);
    } catch (err: unknown) {
      const msg = errorMessage(err, "登录失败");
      if (msg.includes("TOTP") && !requireBoth) {
        setRequireBoth(true);
        setError("该账号要求同时输入 TOTP 验证码");
      } else {
        setError(msg);
      }
    } finally {
      setPending(false);
    }
  }

  async function onSubmitTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = signInTotpSchema.safeParse({ email: email.trim(), code: code.trim() });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "邮箱或验证码格式不正确");
      return;
    }
    setPending(true);
    try {
      const res = await api.auth.loginTotp(parsed.data.email, parsed.data.code);
      login(res.token, res.user);
      router.push(callbackUrl);
    } catch (err: unknown) {
      setError(errorMessage(err, "登录失败，请检查邮箱和验证码。"));
    } finally {
      setPending(false);
    }
  }

  async function onResetPassword() {
    setError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError("请先填写邮箱");
      return;
    }
    setPending(true);
    try {
      await api.auth.resetPassword(parsed.data);
      setResetSent(true);
    } catch {
      setError("发送失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  async function onSendSetup() {
    setError(null);
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError("请先填写邮箱");
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
    <div className="space-y-4">
      {step === "email" ? (
        <form onSubmit={onContinueWithEmail} className="space-y-4">
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
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending} size="lg">
            继续
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border p-3 text-sm flex items-center justify-between gap-3">
            <span className="truncate">{email}</span>
            <button
              type="button"
              className="text-xs text-trans-blue-deep hover:underline shrink-0"
              disabled={pending}
              onClick={() => {
                setStep("email");
                setError(null);
                setShowForgot(false);
                setRequireBoth(false);
                setCode("");
                setPassword("");
              }}
            >
              更换
            </button>
          </div>

          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              type="button"
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === "password" ? "bg-background shadow-sm" : "text-ink-muted hover:text-ink"}`}
              onClick={() => {
                setTab("password");
                setError(null);
                setShowForgot(false);
              }}
            >
              密码
            </button>
            <button
              type="button"
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${tab === "totp" ? "bg-background shadow-sm" : "text-ink-muted hover:text-ink"}`}
              onClick={() => {
                setTab("totp");
                setError(null);
                setShowForgot(false);
              }}
            >
              TOTP
            </button>
          </div>

          {tab === "password" ? (
            <form onSubmit={onSubmitPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  placeholder="登录密码"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={pending}
                />
              </div>
              {requireBoth && (
                <div className="space-y-2">
                  <Label htmlFor="totp-both">TOTP 验证码（该账号要求双重验证）</Label>
                  <Input
                    id="totp-both"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="6 位验证码"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    disabled={pending}
                  />
                </div>
              )}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={pending} size="lg">
                {pending ? "登录中..." : "密码登录"}
              </Button>
              <div className="space-y-2">
                <div className="text-center">
                  <button
                    type="button"
                    className="text-xs text-ink-subtle hover:text-ink"
                    disabled={pending}
                    onClick={() => setShowForgot((v) => !v)}
                  >
                    忘记密码？
                  </button>
                </div>
                {showForgot &&
                  (resetSent ? (
                    <p className="text-xs text-ink-subtle text-center">
                      新密码已发送到你的邮箱，登录后请立即修改。
                    </p>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={pending}
                      onClick={onResetPassword}
                    >
                      {pending ? "处理中..." : "发送密码重置邮件"}
                    </Button>
                  ))}
              </div>
            </form>
          ) : (
            <form onSubmit={onSubmitTotp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="totp">TOTP 验证码</Label>
                <Input
                  id="totp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  placeholder="6 位验证码"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={pending}
                />
              </div>
              {setupSent ? (
                <p className="text-xs text-ink-subtle">初始化邮件已发送，请查收并按步骤设置后登录。</p>
              ) : null}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={pending} size="lg">
                {pending ? "登录中..." : "TOTP 登录"}
              </Button>
              <div className="space-y-2">
                <div className="text-center">
                  <button
                    type="button"
                    className="text-xs text-ink-subtle hover:text-ink"
                    disabled={pending}
                    onClick={() => setShowForgot((v) => !v)}
                  >
                    忘记 TOTP？
                  </button>
                </div>
                {showForgot &&
                  (setupSent ? null : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={pending}
                      onClick={onSendSetup}
                    >
                      {pending ? "处理中..." : "发送 TOTP 初始化邮件"}
                    </Button>
                  ))}
              </div>
              <p className="text-xs text-ink-subtle text-center leading-relaxed">
                认证器 6 位动态验证码，每 30 秒刷新一次。
              </p>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
