"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-context";
import { api } from "@/lib/api";

const TIER_OPTIONS = ["UNVERIFIED", "VERIFIED", "TRUSTED", "ADMIN"];

export function UserActions({
  userId,
  currentTier,
  status,
  onUpdated,
}: {
  userId: string;
  currentTier: string;
  status: string;
  onUpdated?: () => void;
}) {
  const [tier, setTier] = React.useState(currentTier);
  const [pending, setPending] = React.useState(false);
  const [showEmailForm, setShowEmailForm] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const { toast } = useToast();

  async function applyTier() {
    if (tier === currentTier) return;
    setPending(true);
    const res = await api.admin.setUserTier(userId, tier);
    setPending(false);
    if (res.ok) {
      toast({ title: "已更新", variant: "success" });
      onUpdated?.();
    } else {
      toast({ title: "失败", variant: "danger" });
    }
  }

  async function reinitialize() {
    if (!window.confirm("确认重新初始化该用户？这将生成新的 TOTP 密钥和密码（均为待生效状态）并发送欢迎邮件。")) return;
    setPending(true);
    try {
      await api.admin.reinitializeUser(userId);
      toast({ title: "已发送初始化邮件", variant: "success" });
      onUpdated?.();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "操作失败", variant: "danger" });
    } finally {
      setPending(false);
    }
  }

  async function changeEmail(e: React.FormEvent) {
    e.preventDefault();
    const email = newEmail.trim();
    if (!email.includes("@")) {
      toast({ title: "请输入有效的邮箱地址", variant: "danger" });
      return;
    }
    setPending(true);
    try {
      await api.admin.setUserEmail(userId, email);
      toast({ title: "邮箱已更新", variant: "success" });
      setShowEmailForm(false);
      setNewEmail("");
      onUpdated?.();
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "操作失败", variant: "danger" });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIER_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" disabled={pending} onClick={applyTier}>
          提级
        </Button>
        {status === "ACTIVE" ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              if (!window.confirm("确认封禁该用户？")) return;
              setPending(true);
              await api.admin.setUserStatus(userId, "SUSPENDED");
              setPending(false);
              onUpdated?.();
            }}
          >
            封禁
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              await api.admin.setUserStatus(userId, "ACTIVE");
              setPending(false);
              onUpdated?.();
            }}
          >
            恢复
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={pending} onClick={reinitialize}>
          重新初始化
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => setShowEmailForm((v) => !v)}
        >
          改邮箱
        </Button>
      </div>
      {showEmailForm && (
        <form onSubmit={changeEmail} className="flex items-center gap-2">
          <Input
            type="email"
            placeholder="新邮箱地址"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={pending}
            className="w-52 text-sm"
          />
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "..." : "确认"}
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={pending}
            onClick={() => { setShowEmailForm(false); setNewEmail(""); }}>
            取消
          </Button>
        </form>
      )}
    </div>
  );
}
