// Unit tests for worker/src/lib/llm.ts
//
// These exercise the JSON-parsing helpers and the fail-closed behavior of
// moderateAndClassify without making any real HTTP calls.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { moderateAndClassify, __internal } from "../src/lib/llm.js";
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

function mockFetchOnce(payload: unknown, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(payload), {
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

  it("extracts text from anthropic content array", () => {
    const out = __internal.extractText({
      content: [
        { type: "text", text: "hello" },
        { type: "text", text: "world" },
      ],
    });
    expect(out).toBe("hello\nworld");
  });
});

describe("moderateAndClassify", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => {
    fetchSpy.mockRestore();
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
    // Should not have made any HTTP call.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses a clean LLM pass response", async () => {
    mockFetchOnce({
      content: [
        {
          type: "text",
          text: '{"verdict":"pass","reason":"ok","section":"POST","categories":[]}',
        },
      ],
    });
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "hello",
      authorTier: "VERIFIED",
    });
    expect(decision.verdict).toBe("pass");
    expect(decision.section).toBe("POST");
    expect(decision.classifier).toBe("LLM");
  });

  it("propagates reject verdict and reason", async () => {
    mockFetchOnce({
      content: [
        {
          type: "text",
          text: '{"verdict":"reject","reason":"涉嫌广告","section":"POST","categories":["ad"]}',
        },
      ],
    });
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "加微信",
      authorTier: "VERIFIED",
    });
    expect(decision.verdict).toBe("reject");
    expect(decision.reason).toContain("广告");
    expect(decision.categories).toContain("ad");
  });

  it("fails closed on HTTP 500", async () => {
    mockFetchOnce({ error: "server" }, 500);
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "x",
      authorTier: "VERIFIED",
    });
    expect(decision.verdict).toBe("flag");
    expect(decision.classifier).toBe("FALLBACK");
  });

  it("fails closed when response missing verdict", async () => {
    mockFetchOnce({ content: [{ type: "text", text: '{"reason":"oops"}' }] });
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "x",
      authorTier: "VERIFIED",
    });
    expect(decision.verdict).toBe("flag");
  });

  it("fails closed when response text is non-JSON", async () => {
    mockFetchOnce({ content: [{ type: "text", text: "sorry I cannot help" }] });
    const decision = await moderateAndClassify(makeEnv(), {
      kind: "POST",
      body: "x",
      authorTier: "VERIFIED",
    });
    expect(decision.verdict).toBe("flag");
  });
});
