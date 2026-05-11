"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast-context";
import { profileSchema } from "@/lib/validators/user";

type Initial = {
  handle: string;
  displayName: string;
  pronouns: string;
  genderIdentity: string;
  bio: string;
  avatarUrl: string | null;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState(initial.avatarUrl);
  const [form, setForm] = React.useState({
    handle: initial.handle,
    displayName: initial.displayName,
    pronouns: initial.pronouns,
    genderIdentity: initial.genderIdentity,
    bio: initial.bio,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: parsed.error.issues[0]?.message ?? "请检查表单", variant: "danger" });
      return;
    }
    setPending(true);
    try {
      await api.users.updateMe(parsed.data);
      toast({ title: "已保存", variant: "success" });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "保存失败";
      toast({ title: "保存失败", description: msg, variant: "danger" });
    } finally {
      setPending(false);
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await api.files.upload(file, "avatar");
      setAvatarUrl(res.url);
      toast({ title: "头像已更新", variant: "success" });
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "上传失败";
      toast({ title: "上传失败", description: msg, variant: "danger" });
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-border">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xl">
              {form.displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <Label htmlFor="avatar">头像</Label>
            <input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={onAvatarChange}
              className="block text-sm"
            />
            <p className="text-xs text-ink-subtle">
              JPG / PNG，小于 4MB。上传后会自动裁剪并去除元数据。
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="handle">用户名（@）</Label>
              <Input
                id="handle"
                value={form.handle}
                onChange={(e) => set("handle", e.target.value.toLowerCase())}
                placeholder="lowercase-only"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">昵称</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pronouns">代词</Label>
              <Input
                id="pronouns"
                value={form.pronouns}
                onChange={(e) => set("pronouns", e.target.value)}
                placeholder="例如 她/her"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="genderIdentity">性别身份（自由填写）</Label>
              <Input
                id="genderIdentity"
                value={form.genderIdentity}
                onChange={(e) => set("genderIdentity", e.target.value)}
                placeholder="例如 trans woman, non-binary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">自我介绍（支持 Markdown）</Label>
            <Textarea
              id="bio"
              rows={6}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="想让其他成员了解的关于你的事，比如兴趣、所在城市的大致区域、想参加的活动类型……"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type Initial = {
  handle: string;
  displayName: string;
  pronouns: string;
  genderIdentity: string;
  bio: string;
  avatarUrl: string | null;
};

export function ProfileForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [avatarUrl, setAvatarUrl] = React.useState(initial.avatarUrl);
  const [form, setForm] = React.useState({
    handle: initial.handle,
    displayName: initial.displayName,
    pronouns: initial.pronouns,
    genderIdentity: initial.genderIdentity,
    bio: initial.bio,
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: parsed.error.issues[0]?.message ?? "请检查表单", variant: "danger" });
      return;
    }
    setPending(true);
    const res = await saveProfile(parsed.data);
    setPending(false);
    if (res.ok) {
      toast({ title: "已保存", variant: "success" });
      router.refresh();
    } else {
      toast({ title: "保存失败", description: res.error, variant: "danger" });
    }
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    const res = await uploadAvatar(fd);
    if (res.ok) {
      setAvatarUrl(res.url);
      toast({ title: "头像已更新", variant: "success" });
      router.refresh();
    } else {
      toast({ title: "上传失败", description: res.error, variant: "danger" });
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-border">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-xl">
              {form.displayName.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <Label htmlFor="avatar">头像</Label>
            <input
              id="avatar"
              type="file"
              accept="image/*"
              onChange={onAvatarChange}
              className="block text-sm"
            />
            <p className="text-xs text-ink-subtle">
              JPG / PNG，小于 4MB。上传后会自动裁剪并去除元数据。
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="handle">用户名（@）</Label>
              <Input
                id="handle"
                value={form.handle}
                onChange={(e) => set("handle", e.target.value.toLowerCase())}
                placeholder="lowercase-only"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">昵称</Label>
              <Input
                id="displayName"
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pronouns">代词</Label>
              <Input
                id="pronouns"
                value={form.pronouns}
                onChange={(e) => set("pronouns", e.target.value)}
                placeholder="例如 她/her"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="genderIdentity">性别身份（自由填写）</Label>
              <Input
                id="genderIdentity"
                value={form.genderIdentity}
                onChange={(e) => set("genderIdentity", e.target.value)}
                placeholder="例如 trans woman, non-binary"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bio">自我介绍（支持 Markdown）</Label>
            <Textarea
              id="bio"
              rows={6}
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              placeholder="想让其他成员了解的关于你的事，比如兴趣、所在城市的大致区域、想参加的活动类型……"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "保存中..." : "保存"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
