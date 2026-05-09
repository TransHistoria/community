"use client";
import * as React from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-context";
import { scheduleAccountDeletion } from "./actions";

export function DeleteAccountForm() {
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirm !== "DELETE") {
          toast({ title: "请输入 DELETE 以确认", variant: "danger" });
          return;
        }
        if (
          !window.confirm(
            "你的账号会立即被冻结。30 天后将永久删除。是否继续？",
          )
        )
          return;
        setPending(true);
        const res = await scheduleAccountDeletion(confirm);
        setPending(false);
        if (res.ok) {
          await signOut({ callbackUrl: "/" });
        } else {
          toast({ title: "操作失败", description: res.error, variant: "danger" });
        }
      }}
      className="space-y-3"
    >
      <Label htmlFor="confirm">输入 DELETE 以确认</Label>
      <Input
        id="confirm"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        placeholder="DELETE"
        autoComplete="off"
      />
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "处理中..." : "注销账号"}
      </Button>
    </form>
  );
}
