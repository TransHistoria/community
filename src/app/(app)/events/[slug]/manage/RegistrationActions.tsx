"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { decideRegistration } from "@/app/(app)/events/actions";
import { useToast } from "@/components/ui/toast-context";
import { useRouter } from "next/navigation";
import type { RegStatus } from "@/lib/enums";

type DecisionStatus =
  | "CONFIRMED"
  | "WAITLIST"
  | "DECLINED"
  | "CHECKED_IN"
  | "NO_SHOW";

const ACTIONS: Record<RegStatus, { label: string; next: DecisionStatus }[]> = {
  PENDING: [
    { label: "通过", next: "CONFIRMED" },
    { label: "候补", next: "WAITLIST" },
    { label: "拒绝", next: "DECLINED" },
  ],
  CONFIRMED: [
    { label: "标记签到", next: "CHECKED_IN" },
    { label: "标记未到", next: "NO_SHOW" },
    { label: "撤销", next: "DECLINED" },
  ],
  WAITLIST: [
    { label: "提升为已确认", next: "CONFIRMED" },
    { label: "拒绝", next: "DECLINED" },
  ],
  DECLINED: [{ label: "改为已确认", next: "CONFIRMED" }],
  CANCELLED: [],
  CHECKED_IN: [],
  NO_SHOW: [],
};

export function RegistrationActions({
  registrationId,
  currentStatus,
}: {
  registrationId: string;
  currentStatus: RegStatus;
}) {
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const actions = ACTIONS[currentStatus];
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-end">
      {actions.map((a) => (
        <Button
          key={a.next}
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            const res = await decideRegistration(registrationId, a.next);
            setPending(false);
            if (res.ok) {
              toast({ title: "已更新", variant: "success" });
              router.refresh();
            } else {
              toast({ title: "失败", description: res.error, variant: "danger" });
            }
          }}
        >
          {a.label}
        </Button>
      ))}
    </div>
  );
}
