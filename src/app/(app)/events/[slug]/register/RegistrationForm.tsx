"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-context";
import { api } from "@/lib/api";
import { toQueryRoute } from "@/lib/query-routing";

type Question = {
  id: string;
  prompt: string;
  required: boolean;
  type: "text" | "long-text" | "single-choice";
  options?: string[];
};

export function RegistrationForm({
  eventId,
  slug,
  questions,
}: {
  eventId: string;
  slug: string;
  questions: Question[];
}) {
  const [answers, setAnswers] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    for (const q of questions) {
      if (q.required && !(answers[q.id] && answers[q.id].trim())) {
        toast({ title: `请填写：${q.prompt}`, variant: "danger" });
        return;
      }
    }
    setPending(true);
    const res = await api.events.register(eventId, answers);
    setPending(false);
    if (res.ok) {
      toast({
        title:
          res.status === "CONFIRMED"
            ? "报名成功"
            : res.status === "WAITLIST"
              ? "已加入候补"
              : "已提交，等待审核",
        variant: "success",
      });
      router.push(toQueryRoute(`/events/${slug}`));
    } else {
      toast({ title: "报名失败", variant: "danger" });
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="space-y-5">
          {questions.length === 0 ? (
            <p className="text-sm text-ink-muted">组织者没有设置自定义问题，直接提交即可。</p>
          ) : (
            questions.map((q) => (
              <div key={q.id} className="space-y-2">
                <Label>
                  {q.prompt}
                  {q.required ? <span className="text-destructive"> *</span> : null}
                </Label>
                {q.type === "text" ? (
                  <Input
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  />
                ) : q.type === "long-text" ? (
                  <Textarea
                    rows={3}
                    value={answers[q.id] ?? ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  />
                ) : (
                  <Select
                    value={answers[q.id] ?? ""}
                    onValueChange={(v) => setAnswers({ ...answers, [q.id]: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="请选择" />
                    </SelectTrigger>
                    <SelectContent>
                      {(q.options ?? []).map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            ))
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>
              返回
            </Button>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "提交中..." : "提交报名"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
