// LLM-backed content moderation + section classification.
//
// Calls an Anthropic-compatible /v1/messages endpoint (e.g. Deepseek's
// https://api.deepseek.com/anthropic). Returns a normalized decision so the
// posts/events routes can branch on pass/flag/reject without parsing prose.
//
// Fail-closed: any error (network/timeout/non-JSON/missing field) returns a
// `flag` verdict — content is still saved but parked in PENDING_REVIEW so an
// admin can decide. This keeps the door open when Deepseek is rate-limited
// without silently letting questionable content through.

import type { Env } from "@/types";

export type ModerationVerdict = "pass" | "flag" | "reject";

export type ModeratableSection = "POST" | "MEDICAL" | "RESOURCE" | "EVENT";

export type ModerationInputKind = "POST" | "COMMENT" | "EVENT";

export type ModerationInput = {
  kind: ModerationInputKind;
  title?: string;
  body: string;
  hintSection?: ModeratableSection;
  authorTier: string;
};

export type ModerationDecision = {
  verdict: ModerationVerdict;
  reason: string;
  section: ModeratableSection;
  categories: string[];
  classifier: "LLM" | "FALLBACK";
  raw: string;
};

const REQUEST_TIMEOUT_MS = 15000;

const SYSTEM_PROMPT = `你是「跨性别社群」私域平台的内容审核与板块分类助手。

任务：对用户提交的【标题+正文】或【评论】做两件事：
1) 判定是否违反社区规则（中文社区，写中文）。下列任一即视为违规：
   - 色情/性暗示露骨内容、约炮/性服务/性交易
   - 药品（包括激素 HRT、抗抑郁等处方药）的非法买卖、代购、走私
   - 商业广告、拉客引流、推销课程/微商
   - 违法违规（涉政煽动、暴力威胁、人肉/开盒、毒品、赌博）
   - 人身攻击、仇恨言论、对跨性别群体的恶意言论
2) 判定内容应归属哪个板块（POST 普通动态 / MEDICAL 医疗与医生点评 / RESOURCE 技能/求助 / EVENT 线下或线上集体活动）。
   - 即便用户提交时选择了某板块，你仍然以内容为准给出真实归属。
   - 评论(kind=COMMENT)统一返回 section=POST。

输出严格 JSON（不要包裹在 markdown 代码块里，不要任何附加文字）：
{"verdict":"pass|flag|reject","reason":"一句中文,可直接给用户看","section":"POST|MEDICAL|RESOURCE|EVENT","categories":["porn","hookup","drug","ad","illegal","attack",...]}

判定档位：
- pass: 内容合规、归属清晰
- flag: 有边界感、需要人工复核（轻微推销、个人色彩强烈的医生评价、紧急求助等）
- reject: 明显违规

注意作者身份等级 authorTier（GUEST/UNVERIFIED/VERIFIED/TRUSTED/ADMIN）：仅 TRUSTED/ADMIN 才有资格发起活动；如果非 TRUSTED+ 内容判定为 EVENT，应当 reject 并提示「活动需要由信任成员发起，请改发到其他板块或联系组织者」。`;

function buildUserMessage(input: ModerationInput): string {
  const lines = [
    `kind: ${input.kind}`,
    `authorTier: ${input.authorTier}`,
    `hintSection: ${input.hintSection ?? "(unspecified)"}`,
  ];
  if (input.title) lines.push(`title: ${input.title.slice(0, 500)}`);
  lines.push(`body: ${input.body.slice(0, 8000)}`);
  return lines.join("\n");
}

function fallback(reason: string): ModerationDecision {
  return {
    verdict: "flag",
    reason,
    section: "POST",
    categories: [],
    classifier: "FALLBACK",
    raw: "",
  };
}

function parseJsonOutput(text: string): Partial<{
  verdict: string;
  reason: string;
  section: string;
  categories: unknown;
}> | null {
  if (!text) return null;
  // The model sometimes wraps JSON in ```json fences — strip them.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
    // Try to locate the first {...} block if the model added prose.
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function normalizeVerdict(value: unknown): ModerationVerdict | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase();
  if (v === "pass" || v === "flag" || v === "reject") return v;
  return null;
}

function normalizeSection(value: unknown): ModeratableSection {
  if (typeof value !== "string") return "POST";
  const v = value.toUpperCase();
  if (v === "MEDICAL" || v === "RESOURCE" || v === "EVENT" || v === "POST") return v;
  return "POST";
}

function normalizeCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.toLowerCase())
    .slice(0, 10);
}

export async function moderateAndClassify(
  env: Env,
  input: ModerationInput,
): Promise<ModerationDecision> {
  const baseUrl = (env.LLM_BASE_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (env.LLM_API_KEY ?? "").trim();
  const model = (env.LLM_MODEL ?? "").trim();

  if (!baseUrl || !apiKey || !model) {
    return fallback("LLM 审核未配置，已转人工复核");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserMessage(input) }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error("LLM fetch failed:", err);
    return fallback("审核服务暂不可用，已转人工复核");
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error(`LLM HTTP ${res.status}: ${errText.slice(0, 500)}`);
    return fallback(`审核服务返回 ${res.status}，已转人工复核`);
  }

  let payload: unknown;
  try {
    payload = await res.json();
  } catch {
    return fallback("审核服务返回内容无法解析，已转人工复核");
  }

  // Anthropic-style response: { content: [{ type: "text", text: "..." }, ...] }
  const text = extractText(payload);
  const raw = typeof payload === "object" ? JSON.stringify(payload) : String(payload);

  if (!text) return fallback("审核服务返回内容为空，已转人工复核");

  const parsed = parseJsonOutput(text);
  if (!parsed) return { ...fallback("审核结果格式异常，已转人工复核"), raw };

  const verdict = normalizeVerdict(parsed.verdict);
  if (!verdict) return { ...fallback("审核结果缺少 verdict，已转人工复核"), raw };

  const section = normalizeSection(parsed.section);
  const reason =
    typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim().slice(0, 500)
      : verdict === "reject"
        ? "内容存在违规风险"
        : verdict === "flag"
          ? "内容已转人工复核"
          : "内容符合规范";

  return {
    verdict,
    reason,
    section,
    categories: normalizeCategories(parsed.categories),
    classifier: "LLM",
    raw,
  };
}

function extractText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;
  const content = obj.content;
  if (Array.isArray(content)) {
    const chunks: string[] = [];
    for (const part of content) {
      if (part && typeof part === "object") {
        const p = part as Record<string, unknown>;
        if (typeof p.text === "string") chunks.push(p.text);
      }
    }
    return chunks.join("\n").trim();
  }
  // Fallback: some compatible endpoints return a single string field.
  if (typeof obj.text === "string") return obj.text;
  return "";
}

// ---- Test seam: visible so unit tests can exercise the parser without HTTP. ----
export const __internal = {
  parseJsonOutput,
  normalizeVerdict,
  normalizeSection,
  normalizeCategories,
  extractText,
  fallback,
};
