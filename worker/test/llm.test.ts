// Unit tests for worker/src/lib/llm.ts (moderation + xiao-T) and lib/retry.ts.
//
// All HTTP calls are mocked via fetch spy. We never hit a real LLM endpoint.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  moderateAndClassify,
  generateXiaoTReply,
  __internal,
} from "../src/lib/llm.js";
import { withRetry } from "../src/lib/retry.js";
import type { Env } from "../src/types.js";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    DB: {} as any,
    FILES: {} as any,
    SEND_EMAIL: {} as any,
    JWT_SECRET: "test",
    APP_NAME: "Test",
    APP_LOCALE: "zh-CN",
    EMAIL_FROM: "test@test",
    FRONTEND_URL: "http://localhost:3000",
    ADMIN_EMAILS: "",
    LLM_BASE_URL: "https://api.example.com/anthropic",
    LLM_MODEL: "test-model",
    LLM_API_KEY: "test-key",
    ...overrides,
  };
}

let activeFetchSpy: ReturnType<typeof vi.spyOn> | null = null;

function ensureFetchSpy() {
  if (!activeFetchSpy) {
    activeFetchSpy = vi.spyOn(globalThis, "fetch");
  }
  return activeFetchSpy;
}

function queueText(text: string, status = 200) {
  ensureFetchSpy().mockResolvedValueOnce(
    new Response(JSON.stringify({ content: [{ type: "text", text }] }), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

function queueError(status: number, body: unknown = { error: "x" }) {
  ensureFetchSpy().mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("llm parsers", () => {
  it("parses raw JSON", () => {
    expect(__internal.parseJsonOutput('{"verdict":"pass","reason":"ok"}')).toEqual({
      verdict: "pass",
      reason: "ok",
    });
  });

  it("strips ```json fences", () => {
    expect(__internal.parseJsonOutput('```json\n{"verdict":"flag"}\n```')).toEqual({
      verdict: "flag",
    });
  });

  it("finds JSON inside prose", () => {
    expect(__internal.parseJsonOutput('blah {"verdict":"reject","reason":"bad"} blah'))
      .toEqual({ verdict: "reject", reason: "bad" });
  });

  it("returns null on non-JSON garbage", () => {
    expect(__internal.parseJsonOutput("nope")).toBeNull();
  });

  it("normalizes verdicts case-insensitively", () => {
    expect(__internal.normalizeVerdict("PASS")).toBe("pass");
    expect(__internal.normalizeVerdict("Flag")).toBe("flag");
    expect(__internal.normalizeVerdict("Reject")).toBe("reject");
    expect(__internal.normalizeVerdict("unknown")).toBeNull();
    expect(__internal.normalizeVerdict(undefined)).toBeNull();
  });

  it("normalizes section with default", () => {
    expect(__internal.normalizeSection("MEDICAL")).toBe("MEDICAL");
    expect(__internal.normalizeSection("medical")).toBe("MEDICAL");
    expect(__internal.normalizeSection("invalid")).toBe("POST");
    expect(__internal.normalizeSection(42)).toBe("POST");
  });

  it("normalizeStringArray caps length and filters non-strings", () => {
    expect(__internal.normalizeStringArray(["a", "B", 42, ""], 3)).toEqual(["a", "b"]);
    expect(__internal.normalizeStringArray(null, 3)).toEqual([]);
    expect(__internal.normalizeStringArray(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]);
  });

  it("extracts text from anthropic content array, skipping non-text parts", () => {
    const out = __internal.extractText({
      content: [
        { type: "thinking", thinking: "internal" },
        { type: "text", text: "hello" },
        { type: "text", text: "world" },
      ],
    });
    expect(out).toBe("hello\nworld");
  });

  it("normalizeEventDraft accepts well-formed input and trims fields", () => {
    const draft = __internal.normalizeEventDraft({
      title: "  周末聚会  ",
      description: "讲个简单的活动",
      category: "social",
      format: "OFFLINE",
      startAt: "2026-06-21T14:00:00+08:00",
      endAt: "2026-06-21T16:00:00+08:00",
      city: "上海",
      capacity: 30,
    });
    expect(draft).toEqual({
      title: "周末聚会",
      description: "讲个简单的活动",
      category: "SOCIAL",
      format: "OFFLINE",
      startAt: "2026-06-21T14:00:00+08:00",
      endAt: "2026-06-21T16:00:00+08:00",
      city: "上海",
      capacity: 30,
    });
  });

  it("normalizeEventDraft drops invalid category and bad dates", () => {
    const draft = __internal.normalizeEventDraft({
      title: "x",
      category: "MADE_UP",
      startAt: "not-a-date",
    });
    expect(draft?.category).toBeUndefined();
    expect(draft?.startAt).toBeUndefined();
  });

  it("computeDraftCompleteness flags missing required fields", () => {
    const { complete, missing } = __internal.computeDraftCompleteness({
      title: "x",
      description: "y",
      category: "SOCIAL",
      format: "OFFLINE",
      // missing startAt, endAt, city
    });
    expect(complete).toBe(false);
    expect(missing).toContain("开始时间");
    expect(missing).toContain("结束时间");
    expect(missing).toContain("城市");
  });

  it("computeDraftCompleteness passes a fully-spec'd draft", () => {
    const { complete, missing } = __internal.computeDraftCompleteness({
      title: "x",
      description: "y",
      category: "SOCIAL",
      format: "ONLINE",
      startAt: "2026-06-21T14:00:00+08:00",
      endAt: "2026-06-21T16:00:00+08:00",
    });
    expect(complete).toBe(true);
    expect(missing).toEqual([]);
  });

  it("normalizeEventIntent handles strings case-insensitively", () => {
    expect(__internal.normalizeEventIntent("organizing")).toBe("ORGANIZING");
    expect(__internal.normalizeEventIntent("DISCUSSING")).toBe("DISCUSSING");
    expect(__internal.normalizeEventIntent("Discussing")).toBe("DISCUSSING");
    expect(__internal.normalizeEventIntent("other")).toBeUndefined();
    expect(__internal.normalizeEventIntent(null)).toBeUndefined();
  });

  it("computeDraftCompleteness rejects backward time range", () => {
    const { complete, missing } = __internal.computeDraftCompleteness({
      title: "x",
      description: "y",
      category: "SOCIAL",
      format: "ONLINE",
      startAt: "2026-06-21T16:00:00+08:00",
      endAt: "2026-06-21T14:00:00+08:00",
    });
    expect(complete).toBe(false);
    expect(missing.some((m) => m.includes("时间范围"))).toBe(true);
  });
});

describe("withRetry", () => {
  it("returns first success without retry", async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await withRetry(fn, { delays: [10, 10] });
    expect(result).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on retryable error and eventually succeeds", async () => {
    let calls = 0;
    const fn = vi.fn().mockImplementation(async () => {
      calls++;
      if (calls < 3) throw new Error("transient");
      return "ok";
    });
    const result = await withRetry(fn, { delays: [1, 1, 1], shouldRetry: () => true });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after all attempts and throws last error", async () => {
    const err = new Error("boom");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { delays: [1, 1], shouldRetry: () => true })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("respects shouldRetry=false for non-retryable errors", async () => {
    const err = new Error("4xx");
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, { delays: [1, 1], shouldRetry: () => false })).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe("moderateAndClassify", () => {
  beforeEach(() => {
    activeFetchSpy = null;
  });
  afterEach(() => {
    activeFetchSpy?.mockRestore();
    activeFetchSpy = null;
  });

  it("returns FALLBACK flag when LLM not configured", async () => {
    const env = makeEnv({ LLM_API_KEY: "" });
    const decision = await moderateAndClassify(env, {
      kind: "POST",
      body: "test",
      authorTier: "VERIFIED",
    });
    expect(decision.verdict).toBe("flag");
    expect(decision.classifier).toBe("FALLBACK");
    expect(activeFetchSpy).toBeNull();
  });

  it("parses a clean pass response with tags", async () => {
    queueText(
      '{"verdict":"pass","reason":"ok","section":"MEDICAL","tags":["medical-science"],"categories":[]}',
    );
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "讲一下雌二醇代谢的最新研究",
      authorTier: "VERIFIED",
    });
    expect(decision.verdict).toBe("pass");
    expect(decision.section).toBe("MEDICAL");
    expect(decision.tags).toEqual(["medical-science"]);
  });

  it("propagates reject verdict and categories", async () => {
    queueText(
      '{"verdict":"reject","reason":"涉嫌广告","section":"POST","tags":[],"categories":["ad"]}',
    );
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "加微信",
      authorTier: "VERIFIED",
    });
    expect(decision.verdict).toBe("reject");
    expect(decision.categories).toContain("ad");
  });

  it("retries on 500 then succeeds", async () => {
    queueError(500);
    queueError(503);
    queueText('{"verdict":"pass","reason":"ok","section":"POST","tags":[]}');
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "x",
      authorTier: "VERIFIED",
    });
    expect(decision.verdict).toBe("pass");
    expect(activeFetchSpy).toHaveBeenCalledTimes(3);
  }, 20000);

  it("fails closed when all retries exhausted on 5xx", async () => {
    queueError(500);
    queueError(500);
    queueError(500);
    queueError(500);
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "x",
      authorTier: "VERIFIED",
    });
    expect(decision.verdict).toBe("flag");
    expect(decision.classifier).toBe("FALLBACK");
  }, 20000);

  it("fails closed when response missing verdict", async () => {
    queueText('{"reason":"oops"}');
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "x",
      authorTier: "VERIFIED",
    });
    expect(decision.verdict).toBe("flag");
  });

  it("extracts eventDraft when section=EVENT + intent=ORGANIZING", async () => {
    queueText(JSON.stringify({
      verdict: "pass",
      reason: "活动召集",
      section: "EVENT",
      tags: ["announcement"],
      categories: [],
      eventIntent: "ORGANIZING",
      eventDraft: {
        title: "周六读书会",
        description: "讨论《姐妹》",
        category: "STUDY",
        format: "ONLINE",
        startAt: "2026-06-21T14:00:00+08:00",
        endAt: "2026-06-21T16:00:00+08:00",
      },
      eventDraftComplete: true,
      eventDraftMissing: [],
    }));
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "周六下午两点线上读书会",
      authorTier: "TRUSTED",
    });
    expect(decision.section).toBe("EVENT");
    expect(decision.eventIntent).toBe("ORGANIZING");
    expect(decision.eventDraftComplete).toBe(true);
    expect(decision.eventDraft?.title).toBe("周六读书会");
  });

  it("EVENT with DISCUSSING intent has no eventDraft", async () => {
    queueText(JSON.stringify({
      verdict: "pass",
      reason: "在分享/讨论某活动",
      section: "EVENT",
      tags: ["share-life"],
      categories: [],
      eventIntent: "DISCUSSING",
    }));
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "昨天去了那个聚会,大家都很热情~",
      authorTier: "VERIFIED",
    });
    expect(decision.section).toBe("EVENT");
    expect(decision.eventIntent).toBe("DISCUSSING");
    expect(decision.eventDraft).toBeUndefined();
    expect(decision.eventDraftComplete).toBeUndefined();
  });

  it("EVENT without explicit intent defaults to DISCUSSING (safer)", async () => {
    queueText(JSON.stringify({
      verdict: "pass",
      reason: "提了一下某活动",
      section: "EVENT",
      tags: [],
      categories: [],
    }));
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "其他人都去那个聚会了吗",
      authorTier: "VERIFIED",
    });
    expect(decision.eventIntent).toBe("DISCUSSING");
  });

  it("reports incomplete eventDraft when fields missing (ORGANIZING)", async () => {
    queueText(JSON.stringify({
      verdict: "pass",
      reason: "活动召集",
      section: "EVENT",
      tags: [],
      categories: [],
      eventIntent: "ORGANIZING",
      eventDraft: { title: "聚会", format: "OFFLINE" },
      eventDraftComplete: false,
      eventDraftMissing: ["描述", "开始时间", "城市"],
    }));
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "下周聚一下吧",
      authorTier: "TRUSTED",
    });
    expect(decision.eventDraftComplete).toBe(false);
    expect(decision.eventDraftMissing).toContain("城市");
  });
});

describe("generateXiaoTReply", () => {
  beforeEach(() => {
    activeFetchSpy = null;
  });
  afterEach(() => {
    activeFetchSpy?.mockRestore();
    activeFetchSpy = null;
  });

  it("returns null when LLM not configured", async () => {
    const env = makeEnv({ LLM_API_KEY: "" });
    const reply = await generateXiaoTReply(env, { title: "t", body: "b" });
    expect(reply).toBeNull();
    expect(activeFetchSpy).toBeNull();
  });

  it("returns trimmed text on success", async () => {
    queueText("  你好,我是小T,这件事确实让人难过。先深呼吸一下吧。  ");
    const reply = await generateXiaoTReply(makeEnv(), {
      title: "怎么办",
      body: "好难受",
    });
    expect(reply).toContain("小T");
    expect(reply).not.toMatch(/^\s/);
  });

  it("strips markdown fences from reply", async () => {
    queueText("```\n回复内容\n```");
    const reply = await generateXiaoTReply(makeEnv(), { title: "q", body: "b" });
    expect(reply).toBe("回复内容");
  });

  it("returns null on sustained failure", async () => {
    queueError(500);
    queueError(500);
    queueError(500);
    queueError(500);
    const reply = await generateXiaoTReply(makeEnv(), { title: "q", body: "b" });
    expect(reply).toBeNull();
  }, 20000);
});
