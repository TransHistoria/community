"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { EventCategory, EventFormat, Visibility } from "@/lib/enums";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-context";
import {
  ALL_CATEGORIES,
  CATEGORY_LABEL,
  EVENT_VISIBILITY_LABEL,
  FORMAT_LABEL,
} from "./event-config";
import { eventInputSchema, type EventInput } from "@/lib/validators/event";
import { api } from "@/lib/api";
import { Plus, Trash2 } from "lucide-react";

type Question = {
  id: string;
  prompt: string;
  required: boolean;
  type: "text" | "long-text" | "single-choice";
  options?: string[];
};

type EventFormVisibility = Exclude<Visibility, "HIDDEN_REQUEST">;

type FormState = {
  title: string;
  description: string;
  category: EventCategory;
  format: EventFormat;
  coverUrl: string;
  startAt: string;
  endAt: string;
  city: string;
  preciseAddr: string;
  onlineUrl: string;
  capacity: string;
  requireApproval: boolean;
  registrationOpensAt: string;
  registrationClosesAt: string;
  visibility: EventFormVisibility;
  questions: Question[];
};

const DEFAULT: FormState = {
  title: "",
  description: "",
  category: "SOCIAL",
  format: "OFFLINE",
  coverUrl: "",
  startAt: "",
  endAt: "",
  city: "",
  preciseAddr: "",
  onlineUrl: "",
  capacity: "",
  requireApproval: false,
  registrationOpensAt: "",
  registrationClosesAt: "",
  visibility: "VERIFIED",
  questions: [],
};

function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type InitialState = Partial<
  Omit<
    FormState,
    | "startAt"
    | "endAt"
    | "registrationOpensAt"
    | "registrationClosesAt"
    | "questions"
    | "visibility"
  >
> & {
  startAt?: Date | string;
  endAt?: Date | string;
  registrationOpensAt?: Date | string | null;
  registrationClosesAt?: Date | string | null;
  visibility?: "PUBLIC" | "VERIFIED" | "TRUSTED";
  customQuestions?: Question[];
};

export function EventForm({
  mode,
  initial,
  eventId,
}: {
  mode: "create" | "edit";
  initial?: InitialState;
  eventId?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(() => ({
    ...DEFAULT,
    ...(initial as Partial<FormState>),
    startAt: toLocalInput(initial?.startAt) || DEFAULT.startAt,
    endAt: toLocalInput(initial?.endAt) || DEFAULT.endAt,
    registrationOpensAt: toLocalInput(initial?.registrationOpensAt) ?? "",
    registrationClosesAt: toLocalInput(initial?.registrationClosesAt) ?? "",
    visibility: initial?.visibility ?? DEFAULT.visibility,
    questions: initial?.customQuestions ?? [],
  }));

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: EventInput = {
      title: form.title.trim(),
      description: form.description,
      category: form.category,
      format: form.format,
      coverUrl: form.coverUrl || undefined,
      startAt: new Date(form.startAt),
      endAt: new Date(form.endAt),
      timezone: "Asia/Shanghai",
      city: form.city || undefined,
      preciseAddr: form.preciseAddr || undefined,
      onlineUrl: form.onlineUrl || undefined,
      capacity: form.capacity ? Number(form.capacity) : undefined,
      requireApproval: form.requireApproval,
      registrationOpensAt: form.registrationOpensAt
        ? new Date(form.registrationOpensAt)
        : null,
      registrationClosesAt: form.registrationClosesAt
        ? new Date(form.registrationClosesAt)
        : null,
      customQuestions: form.questions,
      visibility: form.visibility,
    };
    const parsed = eventInputSchema.safeParse(payload);
    if (!parsed.success) {
      toast({
        title: "请检查表单",
        description: parsed.error.issues[0]?.message,
        variant: "danger",
      });
      return;
    }
    setPending(true);
    const res =
      mode === "create"
        ? await api.events.create(parsed.data)
        : await api.events.update(eventId!, parsed.data);
    setPending(false);
    if (res.ok) {
      toast({ title: mode === "create" ? "已发布" : "已保存", variant: "success" });
      const slug = (res as { slug?: string }).slug;
      router.push(slug ? `/events/${slug}` : `/events`);
    } else {
      toast({ title: "失败", variant: "danger" });
    }
  }

  function addQuestion() {
    update("questions", [
      ...form.questions,
      {
        id: `q_${Date.now()}`,
        prompt: "",
        required: false,
        type: "text",
      },
    ]);
  }

  function patchQuestion(i: number, q: Partial<Question>) {
    const next = [...form.questions];
    next[i] = { ...next[i], ...q };
    update("questions", next);
  }

  function removeQuestion(i: number) {
    update(
      "questions",
      form.questions.filter((_, ix) => ix !== i),
    );
  }

  const isOnline = form.format === "ONLINE";
  const isOffline = form.format === "OFFLINE";
  const isHybrid = form.format === "HYBRID";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="例如：周日下午茶聚会"
              required
              maxLength={120}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>分类</Label>
              <Select
                value={form.category}
                onValueChange={(v) => update("category", v as EventCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>形式</Label>
              <Select
                value={form.format}
                onValueChange={(v) => update("format", v as EventFormat)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["OFFLINE", "ONLINE", "HYBRID"] as EventFormat[]).map((f) => (
                    <SelectItem key={f} value={f}>
                      {FORMAT_LABEL[f]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">详细介绍（支持 Markdown）</Label>
            <Textarea
              id="description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              rows={8}
              required
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="startAt">开始时间</Label>
              <Input
                id="startAt"
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => update("startAt", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endAt">结束时间</Label>
              <Input
                id="endAt"
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => update("endAt", e.target.value)}
                required
              />
            </div>
          </div>

          {(isOffline || isHybrid) && (
            <>
              <div className="space-y-2">
                <Label htmlFor="city">所在城市（公开）</Label>
                <Input
                  id="city"
                  value={form.city}
                  onChange={(e) => update("city", e.target.value)}
                  placeholder="例如：上海"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="preciseAddr">精确地址（仅报名通过可见）</Label>
                <Input
                  id="preciseAddr"
                  value={form.preciseAddr}
                  onChange={(e) => update("preciseAddr", e.target.value)}
                  placeholder="例如：徐汇区某路某号 X 楼 Y 单元 X 层"
                />
                <p className="text-xs text-ink-subtle">
                  这一项不会出现在活动公开页面，只有报名状态为「已确认」的成员能看到。
                </p>
              </div>
            </>
          )}

          {(isOnline || isHybrid) && (
            <div className="space-y-2">
              <Label htmlFor="onlineUrl">会议链接（仅报名通过可见）</Label>
              <Input
                id="onlineUrl"
                type="url"
                value={form.onlineUrl}
                onChange={(e) => update("onlineUrl", e.target.value)}
                placeholder="例如：https://meet.example.com/xxx"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="capacity">人数上限（留空 = 不限）</Label>
              <Input
                id="capacity"
                type="number"
                min={1}
                max={10000}
                value={form.capacity}
                onChange={(e) => update("capacity", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>可见范围</Label>
              <Select
                value={form.visibility}
                onValueChange={(v) => update("visibility", v as EventFormVisibility)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["PUBLIC", "VERIFIED", "TRUSTED"] as Visibility[]).map((v) => (
                    <SelectItem key={v} value={v}>
                      {EVENT_VISIBILITY_LABEL[v]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="opensAt">报名开放时间（可选）</Label>
              <Input
                id="opensAt"
                type="datetime-local"
                value={form.registrationOpensAt}
                onChange={(e) => update("registrationOpensAt", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="closesAt">报名截止时间（可选）</Label>
              <Input
                id="closesAt"
                type="datetime-local"
                value={form.registrationClosesAt}
                onChange={(e) => update("registrationClosesAt", e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border border-border bg-bg-warm/50 px-4 py-3">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">报名需要审批</div>
              <div className="text-xs text-ink-muted">
                开启后，报名者状态先为「待审核」，需你手动确认才能解锁详情
              </div>
            </div>
            <Switch
              checked={form.requireApproval}
              onCheckedChange={(v) => update("requireApproval", v)}
            />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">报名时的自定义问题（可选）</h3>
              <p className="text-xs text-ink-muted">
                可用于了解参与意愿、过敏、是否第一次参加等信息。
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
              <Plus className="h-4 w-4" /> 添加问题
            </Button>
          </div>
          {form.questions.length === 0 ? (
            <p className="text-sm text-ink-subtle">暂无问题。</p>
          ) : (
            <ul className="space-y-3">
              {form.questions.map((q, i) => (
                <li
                  key={q.id}
                  className="rounded-md border border-border p-3 space-y-2"
                >
                  <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto] items-end">
                    <div className="space-y-1">
                      <Label>题目</Label>
                      <Input
                        value={q.prompt}
                        onChange={(e) =>
                          patchQuestion(i, { prompt: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>类型</Label>
                      <Select
                        value={q.type}
                        onValueChange={(v) =>
                          patchQuestion(i, {
                            type: v as Question["type"],
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">单行</SelectItem>
                          <SelectItem value="long-text">多行</SelectItem>
                          <SelectItem value="single-choice">单选</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestion(i)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {q.type === "single-choice" ? (
                    <div className="space-y-1">
                      <Label>选项（每行一个）</Label>
                      <Textarea
                        rows={3}
                        value={(q.options ?? []).join("\n")}
                        onChange={(e) =>
                          patchQuestion(i, {
                            options: e.target.value.split("\n").filter(Boolean),
                          })
                        }
                      />
                    </div>
                  ) : null}
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) =>
                        patchQuestion(i, { required: e.target.checked })
                      }
                    />
                    必填
                  </label>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          取消
        </Button>
        <Button type="submit" disabled={pending} size="lg">
          {pending ? "保存中..." : mode === "create" ? "发布活动" : "保存修改"}
        </Button>
      </div>
    </form>
  );
}
