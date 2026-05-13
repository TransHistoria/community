"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AUTH_MODE_LABELS: Record<string, string> = {
  EITHER: "密码或 TOTP（默认）",
  PASSWORD_ONLY: "仅密码",
  TOTP_ONLY: "仅 TOTP",
  BOTH_REQUIRED: "同时需要密码和 TOTP",
};

interface SecurityInfo {
  authMode: string;
  passwordSet: boolean;
  totpEnabled: boolean;
}

export function SecurityPreferencesForm() {
  const [info, setInfo] = React.useState<SecurityInfo | null>(null);
  const [authMode, setAuthMode] = React.useState("EITHER");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [totpCode, setTotpCode] = React.useState("");
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api.auth.me().then((u) => {
      setInfo({
        authMode: u.authMode ?? "EITHER",
        passwordSet: u.passwordSet ?? false,
        totpEnabled: u.totpEnabled ?? false,
      });
      setAuthMode(u.authMode ?? "EITHER");
    }).catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!totpCode.trim() && !currentPassword) {
      setError("请提供当前密码或 TOTP 验证码以确认身份");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (newPassword && newPassword.length < 8) {
      setError("密码至少 8 位");
      return;
    }

    setPending(true);
    try {
      await api.auth.updateSecurity({
        totpCode: totpCode.trim() || undefined,
        currentPassword: currentPassword || undefined,
        newPassword: newPassword || undefined,
        authMode: authMode !== info?.authMode ? authMode : undefined,
      });
      setMessage(
        newPassword
          ? "新密码已设为待生效状态，首次使用新密码成功登录后即可激活。"
          : "安全设置已更新。",
      );
      setNewPassword("");
      setConfirmPassword("");
      setTotpCode("");
      setCurrentPassword("");
      setInfo((prev) => prev ? { ...prev, authMode, passwordSet: prev.passwordSet || Boolean(newPassword) } : prev);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "更新失败");
    } finally {
      setPending(false);
    }
  }

  if (!info) return <p className="text-sm text-ink-subtle">加载中…</p>;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Auth mode */}
      <div className="space-y-1">
        <Label>登录方式</Label>
        <Select value={authMode} onValueChange={setAuthMode}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(AUTH_MODE_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-ink-subtle">
          {info.passwordSet ? "✓ 密码已设置" : "✗ 尚未设置密码（先设置密码再切换为密码模式）"}
          {"　"}
          {info.totpEnabled ? "✓ TOTP 已配置" : "✗ TOTP 尚未配置"}
        </p>
      </div>

      {/* New password */}
      <div className="space-y-1">
        <Label htmlFor="new-pw">新密码（留空则不修改）</Label>
        <Input
          id="new-pw"
          type="password"
          autoComplete="new-password"
          placeholder="至少 8 位"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          disabled={pending}
        />
      </div>
      {newPassword && (
        <div className="space-y-1">
          <Label htmlFor="confirm-pw">确认新密码</Label>
          <Input
            id="confirm-pw"
            type="password"
            autoComplete="new-password"
            placeholder="再次输入新密码"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={pending}
          />
        </div>
      )}

      <p className="text-xs text-ink-subtle">
        新密码设置为「待生效」，首次使用新密码成功登录后自动激活（与 TOTP 重置机制相同）。
      </p>

      {/* Identity verification */}
      <div className="border-t pt-4 space-y-3">
        <p className="text-xs font-medium text-ink-subtle">身份验证（TOTP 验证码或当前密码，二选一）</p>
        <div className="space-y-1">
          <Label htmlFor="verify-totp">TOTP 验证码</Label>
          <Input
            id="verify-totp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="6 位验证码"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            disabled={pending}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="verify-pw">当前密码</Label>
          <Input
            id="verify-pw"
            type="password"
            autoComplete="current-password"
            placeholder="当前密码"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={pending}
          />
        </div>
      </div>

      {message ? <p className="text-xs text-emerald-600">{message}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "保存中..." : "保存安全设置"}
      </Button>
    </form>
  );
}
