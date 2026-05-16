"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api, type ModerationDecision } from "@/lib/api";
import { POST_SECTION_LABEL, RESOURCE_KIND_LABEL, type PostSection, type ResourceKind } from "@/lib/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast-context";
import { toQueryRoute } from "@/lib/query-routing";

type Mode = "create" | "edit";

type Initial = Partial<{
  section: PostSection;
  title: string;
  body: string;
  hospital: string;
  doctor: string;
  city: string;
  resourceKind: ResourceKind;
  visibility: string;
}>;

const SECTIONS: PostSection[] = ["POST", "MEDICAL", "RESOURCE"];

export function PostForm({
  mode,
  postId,
  initial,
}: {
  mode: Mode;
  postId?: string;
  initial?: Initial;
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [section, setSection] = React.useState<PostSection>(initial?.section ?? "POST");
  const [title, setTitle] = React.useState(initial?.title ?? "");
  const [body, setBody] = React.useState(initial?.body ?? "");
  const [hospital, setHospital] = React.useState(initial?.hospital ?? "");
  const [doctor, setDoctor] = React.useState(initial?.doctor ?? "");
  const [city, setCity] = React.useState(initial?.city ?? "");
  const [resourceKind, setResourceKind] = React.useState<ResourceKind | "">(initial?.resourceKind ?? "");
  const [visibility, setVisibility] = React.useState(initial?.visibility ?? "VERIFIED");
  const [submitting, setSubmitting] = React.useState(false);
  const [moderation, setModeration] = React.useState<ModerationDecision | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setModeration(null);
    try {
      const payload = {
        section,
        title: title.trim(),
        body: body.trim(),
        hospital: hospital.trim() || undefined,
        doctor: doctor.trim() || undefined,
        city: city.trim() || undefined,
        resourceKind: section === "RESOURCE" && resourceKind ? resourceKind : undefined,
        visibility,
      };

      if (section === "MEDICAL" && !payload.hospital) {
        toast({ title: "请填写医院/机构名称", variant: "danger" });
        setSubmitting(false);
        return;
      }
      if (section === "RESOURCE" && !payload.resourceKind) {
        toast({ title: "请选择资源类型(提供/求助)", variant: "danger" });
        setSubmitting(false);
        return;
      }

      if (mode === "create") {
        const res = await api.posts.create(payload);
        setModeration(res.moderation);
        if (res.status === "PENDING_REVIEW") {
          toast({ title: "已提交,等待人工复核", description: res.moderation.reason });
        } else {
          toast({ title: "发布成功", variant: "success" });
        }
        router.push(toQueryRoute(`/posts/${res.id}`));
      } else if (postId) {
        const res = await api.posts.update(postId, payload);
        setModeration(res.moderation);
        toast({ title: "已保存", variant: "success" });
        router.push(toQueryRoute(`/posts/${postId}`));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "提交失败";
      toast({ title: "提交失败", description: msg, variant: "danger" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label>板块</Label>
            <div className="flex flex-wrap gap-2">
              {SECTIONS.map((s) => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setSection(s)}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (section === s
                      ? "bg-trans-gradient text-white border-transparent shadow-soft"
                      : "border-border bg-card text-ink-muted hover:text-ink")
                  }
                >
                  {POST_SECTION_LABEL[s]}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-subtle">
              板块仅供参考,LLM 会根据内容自动分类。错位发到「活动」会被退回。
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                section === "MEDICAL"
                  ? "例如:北京同仁医院张主任的就诊体验"
                  : section === "RESOURCE"
                    ? "例如:可以帮忙办身份证更改/求助合租"
                    : "一句话写清楚要点"
              }
              maxLength={200}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="body">正文</Label>
            <Textarea
              id="body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="写得具体一点,让大家更容易帮到你或被你帮到。支持 Markdown。"
              minLength={5}
              maxLength={20000}
              rows={10}
              required
            />
            <p className="text-xs text-ink-subtle">{body.length} / 20000</p>
          </div>
        </CardContent>
      </Card>

      {section === "MEDICAL" ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="font-serif text-h3">医疗信息</p>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hospital">医院/机构</Label>
                <Input
                  id="hospital"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  placeholder="必填"
                  maxLength={80}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="doctor">医生姓名(可选)</Label>
                <Input
                  id="doctor"
                  value={doctor}
                  onChange={(e) => setDoctor(e.target.value)}
                  maxLength={60}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">城市</Label>
                <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={40} />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {section === "RESOURCE" ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <p className="font-serif text-h3">资源类型</p>
            <div className="flex gap-2">
              {(["OFFER", "REQUEST"] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setResourceKind(k)}
                  className={
                    "rounded-full border px-3 py-1.5 text-sm transition-colors " +
                    (resourceKind === k
                      ? "bg-trans-gradient text-white border-transparent shadow-soft"
                      : "border-border bg-card text-ink-muted hover:text-ink")
                  }
                >
                  {RESOURCE_KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="visibility">可见性</Label>
            <select
              id="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="PUBLIC">公开(所有访客)</option>
              <option value="VERIFIED">认证成员可见(默认)</option>
              <option value="TRUSTED">仅信任成员可见</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {moderation ? (
        <Card>
          <CardContent className="pt-6 text-sm">
            <p className="font-medium mb-2">AI 审核结果</p>
            <ul className="list-disc pl-5 space-y-1 text-ink-muted">
              <li>结论:{moderation.verdict}</li>
              <li>原因:{moderation.reason}</li>
              <li>建议板块:{moderation.section}</li>
              {moderation.categories.length > 0 ? (
                <li>命中标签:{moderation.categories.join(", ")}</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()}>
          取消
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "提交中…" : mode === "create" ? "发布" : "保存"}
        </Button>
      </div>
    </form>
  );
}
