"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={tier} onValueChange={setTier}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TIER_OPTIONS.map((t) => (
            <SelectItem key={t} value={t}>
              {t}
            </SelectItem>
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
    </div>
  );
}
