"use client";
import * as React from "react";
import { Search, X, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast-context";
import { TierBadge } from "@/components/user/TierBadge";
import { api } from "@/lib/api";

type Candidate = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  tier: string;
};

export function ShareToUser({
  eventId,
  onDone,
}: {
  eventId: string;
  onDone: () => void;
}) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Candidate[]>([]);
  const [selected, setSelected] = React.useState<Candidate[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  React.useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await api.events.searchSharableUsers({ q: q.trim() });
      setSearching(false);
      const list = (res as { users?: Candidate[] }).users ?? [];
      const selectedIds = new Set(selected.map((s) => s.id));
      setResults(list.filter((r) => !selectedIds.has(r.id)));
    }, 220);
    return () => clearTimeout(t);
  }, [q, selected]);

  function pick(c: Candidate) {
    setSelected((s) => (s.length >= 10 ? s : [...s, c]));
    setQ("");
    setResults([]);
  }

  function remove(id: string) {
    setSelected((s) => s.filter((x) => x.id !== id));
  }

  async function send() {
    if (selected.length === 0) {
      toast({ title: "请先选择至少一位成员", variant: "danger" });
      return;
    }
    setPending(true);
    const res = await api.events.shareToUsers({
      eventId,
      recipientIds: selected.map((s) => s.id),
    });
    setPending(false);
    if (res.ok) {
      toast({ title: "已推荐给所选成员", variant: "success" });
      onDone();
    } else {
      toast({ title: "分享失败", variant: "danger" });
    }
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <Badge key={s.id} variant="blue" className="gap-1 pr-1 py-1">
              <span>@{s.handle}</span>
              <button onClick={() => remove(s.id)} aria-label="移除"
                className="rounded-full hover:bg-trans-blue/20 p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="按昵称或 @handle 搜索成员"
          className="pl-9"
          disabled={selected.length >= 10}
        />
      </div>

      {q.trim() && (
        <div className="rounded-md border border-border bg-card max-h-64 overflow-y-auto">
          {searching ? (
            <div className="px-3 py-4 text-sm text-ink-muted">搜索中…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-ink-muted">没有匹配的成员</div>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => pick(r)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-bg-muted transition-colors">
                    <Avatar className="h-8 w-8">
                      {r.avatarUrl ? <AvatarImage src={r.avatarUrl} alt="" /> : null}
                      <AvatarFallback className="text-xs">{r.displayName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{r.displayName}</div>
                      <div className="text-xs text-ink-subtle">@{r.handle}</div>
                    </div>
                    <TierBadge tier={r.tier} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-ink-subtle leading-relaxed">
        对方会收到一条「@{`{你}`} 向你推荐了「活动名」」的通知，附带链接。
        本平台没有私信，所以无法在此附加自定义留言；如需多说几句，可以在活动评论中公开发布。
      </p>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => { setSelected([]); setQ(""); }}>
          清空
        </Button>
        <Button onClick={send} disabled={pending || selected.length === 0}>
          <Send className="h-4 w-4" />
          {pending ? "正在发送…" : `推荐给 ${selected.length || ""} 位成员`}
        </Button>
      </div>
    </div>
  );
}
type Candidate = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  tier: string;
};

export function ShareToUser({
  eventId,
  onDone,
}: {
  eventId: string;
  onDone: () => void;
}) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<Candidate[]>([]);
  const [selected, setSelected] = React.useState<Candidate[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const { toast } = useToast();

  // Debounced search
  React.useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await searchSharableUsers({ q: q.trim() });
      setSearching(false);
      if (res.ok) {
        const selectedIds = new Set(selected.map((s) => s.id));
        setResults(res.results.filter((r) => !selectedIds.has(r.id)));
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, selected]);

  function pick(c: Candidate) {
    setSelected((s) => (s.length >= 10 ? s : [...s, c]));
    setQ("");
    setResults([]);
  }

  function remove(id: string) {
    setSelected((s) => s.filter((x) => x.id !== id));
  }

  async function send() {
    if (selected.length === 0) {
      toast({ title: "请先选择至少一位成员", variant: "danger" });
      return;
    }
    setPending(true);
    const res = await shareEventToUsers({
      eventId,
      recipientIds: selected.map((s) => s.id),
    });
    setPending(false);
    if (res.ok) {
      toast({
        title: `已推荐给 ${res.sent} 位成员`,
        variant: "success",
      });
      onDone();
    } else {
      toast({ title: "分享失败", description: res.error, variant: "danger" });
    }
  }

  return (
    <div className="space-y-3">
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <Badge
              key={s.id}
              variant="blue"
              className="gap-1 pr-1 py-1"
            >
              <span>@{s.handle}</span>
              <button
                onClick={() => remove(s.id)}
                aria-label="移除"
                className="rounded-full hover:bg-trans-blue/20 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-subtle" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="按昵称或 @handle 搜索成员"
          className="pl-9"
          disabled={selected.length >= 10}
        />
      </div>

      {q.trim() && (
        <div className="rounded-md border border-border bg-card max-h-64 overflow-y-auto">
          {searching ? (
            <div className="px-3 py-4 text-sm text-ink-muted">搜索中…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-4 text-sm text-ink-muted">
              没有匹配的成员
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => pick(r)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-bg-muted transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      {r.avatarUrl ? (
                        <AvatarImage src={r.avatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback className="text-xs">
                        {r.displayName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {r.displayName}
                      </div>
                      <div className="text-xs text-ink-subtle">@{r.handle}</div>
                    </div>
                    <TierBadge tier={r.tier} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="text-xs text-ink-subtle leading-relaxed">
        对方会收到一条「@{`{你}`} 向你推荐了「活动名」」的通知，附带链接。
        本平台没有私信，所以无法在此附加自定义留言；如需多说几句，可以在活动评论中公开发布。
      </p>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          onClick={() => {
            setSelected([]);
            setQ("");
          }}
        >
          清空
        </Button>
        <Button onClick={send} disabled={pending || selected.length === 0}>
          <Send className="h-4 w-4" />
          {pending
            ? "正在发送…"
            : `推荐给 ${selected.length || ""} 位成员`}
        </Button>
      </div>
    </div>
  );
}
