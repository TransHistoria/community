"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export function ApplyForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [agree, setAgree] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const identity = String(fd.get("identity") ?? "").trim();
    const motivation = String(fd.get("motivation") ?? "").trim();
    const vouch = String(fd.get("vouch") ?? "").trim() || undefined;
    if (!email || !identity || !motivation) {
      setError("请检查表单");
      return;
    }
    setPending(true);
    try {
      await api.applications.submit(email, { identity, motivation, vouch });
      router.push("/apply/pending");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "提交失败，请稍后重试";
      setError(msg);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="email">联系邮箱</Label>
        <Input id="email" name="email" type="email" required />
        <p className="text-xs text-ink-subtle">
          通过审核后会用这个邮箱通知你，并作为登录邮箱。
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="identity">关于你自己（自我认同）</Label>
        <Textarea
          id="identity"
          name="identity"
          rows={4}
          placeholder="例如：我是一位 trans woman，目前居住在……，对自己的认同已经……"
          required
        />
        <p className="text-xs text-ink-subtle">
          你可以写得很简单，也可以写得展开。我们关心的是你怎么描述自己，而不是你「证明」了什么。
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="motivation">想加入这里做什么</Label>
        <Textarea
          id="motivation"
          name="motivation"
          rows={4}
          placeholder="例如：希望参加一些线下聚会、想找游戏车队、希望和大家交流……"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vouch">
          你认识社群里的成员吗？（选填）
        </Label>
        <Input
          id="vouch"
          name="vouch"
          placeholder="如有，可填对方的昵称或邮箱（不强制）"
        />
        <p className="text-xs text-ink-subtle">
          这一栏只是提供另一个核实你身份的线索；不填不会影响审核结果。
        </p>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <Checkbox
          checked={agree}
          onCheckedChange={(v) => setAgree(v === true)}
          className="mt-0.5"
          aria-label="我已阅读社区守则"
        />
        <span className="text-ink-muted leading-relaxed">
          我已阅读并同意<a href="/about#community-guidelines" target="_blank" className="text-trans-blue-deep hover:underline">社区守则</a>。
        </span>
      </label>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending || !agree}>
        {pending ? "正在提交..." : "提交申请"}
      </Button>
    </form>
  );
}
