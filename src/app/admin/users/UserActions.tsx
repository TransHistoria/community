"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-context";
import { useRouter } from "next/navigation";
import { reactivateUser, setUserTier, suspendUser } from "@/app/admin/actions";
import type { UserTier, UserStatus } from "@/lib/enums";

const TIER_OPTIONS: UserTier[] = [
  "UNVERIFIED",
  "VERIFIED",
  "TRUSTED",
  "ADMIN",
];

export function UserActions({
  userId,
  currentTier,
  status,
}: {
  userId: string;
  currentTier: UserTier;
  status: UserStatus;
}) {
  const [tier, setTier] = React.useState<UserTier>(currentTier);
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function applyTier() {
    if (tier === currentTier) return;
    setPending(true);
    const res = await setUserTier(userId, tier);
    setPending(false);
    if (res.ok) {
      toast({ title: "已更新", variant: "success" });
      router.refresh();
    } else {
      toast({ title: "失败", description: res.error, variant: "danger" });
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value={tier} onValueChange={(v) => setTier(v as UserTier)}>
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
            await suspendUser(userId);
            setPending(false);
            router.refresh();
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
            await reactivateUser(userId);
            setPending(false);
            router.refresh();
          }}
        >
          恢复
        </Button>
      )}
    </div>
  );
}
