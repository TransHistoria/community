"use client";
import * as React from "react";
import { api } from "@/lib/api";
import type { ContactKind, Visibility } from "@/lib/enums";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast-context";
import { Trash2, Pencil, Plus, X } from "lucide-react";
import {
  CONTACT_KIND_LABEL,
  VISIBILITY_LABEL,
  VISIBILITY_SHORT,
} from "@/components/user/contact-config";

type ContactMethod = {
  id: string;
  kind: string;
  value: string;
  label?: string | null;
  visibility: string;
};

type Draft = {
  kind: ContactKind;
  value: string;
  label: string;
  visibility: Visibility;
};

const EMPTY_DRAFT: Draft = {
  kind: "WECHAT",
  value: "",
  label: "",
  visibility: "VERIFIED",
};

const KINDS: ContactKind[] = [
  "WECHAT",
  "TELEGRAM",
  "EMAIL",
  "PHONE",
  "QQ",
  "XHS",
  "WEIBO",
  "DISCORD",
  "OTHER",
];
const VISIBILITIES: Visibility[] = [
  "PUBLIC",
  "VERIFIED",
  "TRUSTED",
  "HIDDEN_REQUEST",
];

export function ContactsManager({
  contacts,
  onRefresh,
}: {
  contacts: unknown[];
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editDraft, setEditDraft] = React.useState<Draft>(EMPTY_DRAFT);

  const items = contacts as ContactMethod[];

  async function onAdd() {
    if (!draft.value.trim()) {
      toast({ title: "请填写联系方式", variant: "danger" });
      return;
    }
    try {
      await api.users.addContact(draft);
      toast({ title: "已添加", variant: "success" });
      setDraft(EMPTY_DRAFT);
      setAdding(false);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "添加失败";
      toast({ title: "添加失败", description: msg, variant: "danger" });
    }
  }

  function startEdit(c: ContactMethod) {
    setEditingId(c.id);
    setEditDraft({
      kind: c.kind as ContactKind,
      value: c.value,
      label: c.label ?? "",
      visibility: c.visibility as Visibility,
    });
  }

  async function onUpdate(id: string) {
    try {
      await api.users.updateContact(id, editDraft);
      toast({ title: "已更新", variant: "success" });
      setEditingId(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "更新失败";
      toast({ title: "更新失败", description: msg, variant: "danger" });
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("确认删除这条联系方式？")) return;
    try {
      await api.users.deleteContact(id);
      toast({ title: "已删除", variant: "success" });
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "删除失败";
      toast({ title: "删除失败", description: msg, variant: "danger" });
    }
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">还没有添加任何联系方式。</p>
      ) : (
        <ul className="space-y-2">
          {items.map((c) => {
            const isEditing = editingId === c.id;
            return (
              <li key={c.id}>
                <Card>
                  <CardContent className="py-4 space-y-3">
                    {isEditing ? (
                      <ContactDraftFields draft={editDraft} setDraft={setEditDraft} />
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {c.label ?? CONTACT_KIND_LABEL[c.kind]}
                            <span className="ml-2 text-xs font-normal text-ink-subtle">
                              {CONTACT_KIND_LABEL[c.kind]}
                            </span>
                          </div>
                          <div className="font-mono text-sm">{c.value}</div>
                        </div>
                        <Badge variant="outline">{VISIBILITY_SHORT[c.visibility]}</Badge>
                      </div>
                    )}
                    <div className="flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                            <X className="h-4 w-4" /> 取消
                          </Button>
                          <Button size="sm" onClick={() => onUpdate(c.id)}>
                            保存
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => startEdit(c)}>
                            <Pencil className="h-4 w-4" /> 编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(c.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /> 删除
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {adding ? (
        <Card>
          <CardContent className="py-4 space-y-3">
            <ContactDraftFields draft={draft} setDraft={setDraft} />
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdding(false)}>
                取消
              </Button>
              <Button size="sm" onClick={onAdd}>
                添加
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setAdding(true)} className="w-full">
          <Plus className="h-4 w-4" /> 添加联系方式
        </Button>
      )}

      <p className="text-xs text-ink-subtle leading-relaxed pt-2">
        提示：「需申请」可见性的项默认对其他成员显示为锁状态，他人需要填写理由后由你审批；
        「公开」对所有人可见，包括未登录的访客——请慎用，建议仅用于工作邮箱或社交平台公开主页。
      </p>
    </div>
  );
}

function ContactDraftFields({
  draft,
  setDraft,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>类型</Label>
        <Select
          value={draft.kind}
          onValueChange={(v) => setDraft({ ...draft, kind: v as ContactKind })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {CONTACT_KIND_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>可见性</Label>
        <Select
          value={draft.visibility}
          onValueChange={(v) => setDraft({ ...draft, visibility: v as Visibility })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VISIBILITIES.map((v) => (
              <SelectItem key={v} value={v}>
                {VISIBILITY_LABEL[v]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>联系方式</Label>
        <Input
          value={draft.value}
          onChange={(e) => setDraft({ ...draft, value: e.target.value })}
          placeholder="账号 / 号码 / 链接"
        />
      </div>
      <div className="space-y-1.5 sm:col-span-2">
        <Label>备注（可选）</Label>
        <Input
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          placeholder="显示给他人的名称，例如「常用邮箱」"
        />
      </div>
    </div>
  );
}
