"use client";
import * as React from "react";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast-context";

export function CreateInviteForm({ onCreated }: { onCreated: () => void }) {
  const [note, setNote] = React.useState("");
  const [days, setDays] = React.useState("30");
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      const res = await api.users.createInvite({
        note,
        expiresInDays: Number(days) || undefined,
      });
      toast({ title: "已签发", description: res.code, variant: "success" });
      setNote("");
      onCreated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "签发失败";
      toast({ title: "签发失败", description: msg, variant: "danger" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardContent className="py-4">
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] items-end">
          <div className="space-y-1.5">
            <Label htmlFor="note">备注（仅自己可见）</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：给小 X，认识 5 年"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="days">有效天数</Label>
            <Input
              id="days"
              type="number"
              min={1}
              max={365}
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-24"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "..." : "签发"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
