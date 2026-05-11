"use client";
import * as React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-context";

export function DeleteAccountForm() {
  const [confirm, setConfirm] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const { logout } = useAuth();

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (confirm !== "DELETE") {
          toast({ title: "请输入 DELETE 以确认", variant: "danger" });
          return;
        }
        if (!window.confirm("你的账号会立即被冻结。30 天后将永久删除。是否继续？"))
          return;
        setPending(true);
        try {
          const token = localStorage.getItem("tc_token");
          const res = await fetch("/api/users/me", {
            method: "DELETE",
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error((body as { error?: string }).error ?? "操作失败");
          }
          logout();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "操作失败";
          toast({ title: "操作失败", description: msg, variant: "danger" });
        } finally {
          setPending(false);
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
