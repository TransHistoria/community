// LLM-backed content moderation + section classification + tag extraction,
// plus the 小T (xiao_t) auto-reply generator for question/help posts.
//
// Both functions call an Anthropic-compatible /v1/messages endpoint (e.g.
// Deepseek's https://api.deepseek.com/anthropic) with retry on transient
// errors. They fail closed: any sustained failure of moderateAndClassify
// returns a `flag` verdict so the post is parked in PENDING_REVIEW for an
// admin to look at, rather than silently passing or silently dropping.

import type { Env } from "../types";
import { withRetry } from "./retry";

export type ModerationVerdict = "pass" | "flag" | "reject";

export type ModeratableSection = "POST" | "MEDICAL" | "RESOURCE" | "EVENT";

export type ModerationInputKind = "POST" | "COMMENT" | "EVENT";

export type PostTag =
  | "medical-hospital-review"
  | "medical-science"
  | "medical-experience"
  | "resource-offer"
  | "resource-request"
  | "question-help"
  | "share-life"
  | "share-resource"
  | "announcement";

export type ModerationInput = {
  kind: ModerationInputKind;
  title?: string;
  body: string;
  authorTier: string;
};

export type ModerationDecision = {
  verdict: ModerationVerdict;
  reason: string;
  section: ModeratableSection;
  tags: string[];
  categories: string[];
  classifier: "LLM" | "FALLBACK";
  raw: string;
};

const REQUEST_TIMEOUT_MS = 15000;

const MOD_SYSTEM_PROMPT = `你是「跨性别社群」私域平台的内容审核与分类助手。

任务（一次性输出 JSON,覆盖以下四件事）:

1) verdict — 内容是否违规
   - "reject": 明显违规(色情/约炮、药品/激素非法买卖、广告拉客、违法违规、人身攻击、仇恨言论)
   - "flag":  存在边界感、需要人工复核(轻微推销、个人色彩强烈的医生评价、隐含求购药物、紧急人身安全求助等)
   - "pass":  正常合规

2) section — 顶层归属
   - "EVENT":     是组织线下/线上集体活动的提议或邀请
   - "MEDICAL":   涉及医疗、HRT、心理、医院、医生、医学知识、学术研究、个人就诊或用药经历
   - "RESOURCE":  提供或寻求帮助/技能/资源(找室友、求陪伴、能提供翻译等)
   - "POST":      其他日常分享、心情、提问

3) tags — 从下面受控词表选 1~3 个最贴切:
   - medical-hospital-review (具体医院/医生的就诊或预约体验)
   - medical-science         (跨性别医疗科普、研究、知识、学术进展)
   - medical-experience      (作者自己的 HRT/手术/复诊经历分享,不针对具体医生)
   - resource-offer          (我可以提供的技能/物品/帮助)
   - resource-request        (我需要的帮助、求人)
   - question-help           (提问/求建议/不知道怎么办)
   - share-life              (一般生活、心情、小事分享)
   - share-resource          (转发外部资源链接、推荐书单/影单)
   - announcement            (社群通知、活动预告、招募)

4) categories — verdict 是 reject/flag 时填命中的违规分类标签(porn/hookup/drug/ad/illegal/attack 等)

重要:
- 即便用户没说自己想发到哪里,你也要给出最合适的 section。
- 不要因为「没填医院名」就拒绝医疗科普类内容。医疗科普/知识/学术/经验分享都允许 pass。
- 仅 TRUSTED/ADMIN 等级才有资格发起活动。如果 kind=POST 但内容明显是要发起活动而且 authorTier 不是 TRUSTED/ADMIN,verdict=reject,reason 引导对方改发到非活动板块或联系信任成员组织。
- 评论(kind=COMMENT)统一返回 section=POST,tags=[]。

返回严格 JSON(不要 markdown 围栏、不要前后多余文字):
{"verdict":"pass|flag|reject","reason":"一句中文","section":"...","tags":[...],"categories":[...]}`;

const XIAO_T_SYSTEM_PROMPT = `你是「小T」,跨性别社群里的 AI 陪伴员。

你的语气:温柔、共情、不评判、不教训。你不是医生、不是法律顾问、不是治疗师。

收到一条用户发的求助/提问帖。请用 80~180 字的中文给出一段温和的初步回应。规则:
- 第一句先共情,承认对方此刻的感受或处境
- 如果合适,可以给 1~2 个具体的小建议或思路(避免「应该」「必须」这种命令式措辞)
- 涉及医疗/法律/紧急安全时,温和地引导对方去找专业资源(具体医院科室名、可信热线、社群里的相关帖子等),不要替专业人士做判断
- 自称「小T」。不要说「我是 AI」「我是模型」「我没有情感」。也不要承诺会持续跟进
- 不要要求对方加微信、加联系方式或转移到私聊

只输出回复文本,不要 JSON、不要前后说明、不要 markdown 标题。`;

function buildModerationUserMessage(input: ModerationInput): string {
  const lines = [
    `kind: ${input.kind}`,
    `authorTier: ${input.authorTier}`,
  ];
  if (input.title) lines.push(`title: ${input.title.slice(0, 500)}`);
  lines.push(`body: ${input.body.slice(0, 8000)}`);
  return lines.join("\n");
}

function fallbackDecision(reason: string): ModerationDecision {
  return {
    verdict: "flag",
    reason,
    section: "POST",
    tags: [],
    categories: [],
    classifier: "FALLBACK",
    raw: "",
  };
}

function parseJsonOutput(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
  } catch {
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

function normalizeStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c): c is string => typeof c === "string")
    .map((c) => c.toLowerCase().trim())
    .filter((c) => c.length > 0 && c.length <= 60)
    .slice(0, max);
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
  if (typeof obj.text === "string") return obj.text;
  return "";
}

class HttpStatusError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpStatusError";
  }
}

async function callLLM(
  env: Env,
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ text: string; raw: string }> {
  const baseUrl = (env.LLM_BASE_URL ?? "").trim().replace(/\/$/, "");
  const apiKey = (env.LLM_API_KEY ?? "").trim();
  const model = (env.LLM_MODEL ?? "").trim();
  if (!baseUrl || !apiKey || !model) {
    throw new Error("LLM is not configured");
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
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new HttpStatusError(res.status, `LLM HTTP ${res.status}: ${detail.slice(0, 300)}`);
  }
  const payload = await res.json().catch(() => null);
  const text = extractText(payload);
  const raw = payload ? JSON.stringify(payload) : "";
  return { text, raw };
}

function shouldRetryLlm(err: unknown): boolean {
  if (err instanceof HttpStatusError) return err.status >= 500;
  // network/abort/parse failures
  return true;
}

export async function moderateAndClassify(
  env: Env,
  input: ModerationInput,
): Promise<ModerationDecision> {
  if (!(env.LLM_API_KEY ?? "").trim()) {
    return fallbackDecision("LLM 审核未配置,已转人工复核");
  }

  let text: string;
  let raw: string;
  try {
    const result = await withRetry(
      () => callLLM(env, MOD_SYSTEM_PROMPT, buildModerationUserMessage(input), 500),
      { label: "moderate", shouldRetry: shouldRetryLlm },
    );
    text = result.text;
    raw = result.raw;
  } catch (err) {
    console.error("moderateAndClassify failed after retries:", err);
    return fallbackDecision("审核服务暂不可用,已转人工复核");
  }

  if (!text) return { ...fallbackDecision("审核服务返回内容为空,已转人工复核"), raw };

  const parsed = parseJsonOutput(text);
  if (!parsed) return { ...fallbackDecision("审核结果格式异常,已转人工复核"), raw };

  const verdict = normalizeVerdict(parsed.verdict);
  if (!verdict) return { ...fallbackDecision("审核结果缺少 verdict,已转人工复核"), raw };

  const section = normalizeSection(parsed.section);
  const tags = normalizeStringArray(parsed.tags, 3);
  const categories = normalizeStringArray(parsed.categories, 10);
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
    tags,
    categories,
    classifier: "LLM",
    raw,
  };
}

export async function generateXiaoTReply(
  env: Env,
  post: { title: string; body: string },
): Promise<string | null> {
  if (!(env.LLM_API_KEY ?? "").trim()) return null;

  const user = `标题:${post.title.slice(0, 300)}\n正文:${post.body.slice(0, 4000)}`;
  try {
    const { text } = await withRetry(
      () => callLLM(env, XIAO_T_SYSTEM_PROMPT, user, 400),
      { label: "xiao-t", shouldRetry: shouldRetryLlm },
    );
    const trimmed = text.trim();
    if (!trimmed) return null;
    // Strip accidental markdown fences if model wrapped reply.
    return trimmed
      .replace(/^```[a-zA-Z]*\s*/, "")
      .replace(/\s*```$/, "")
      .slice(0, 600);
  } catch (err) {
    console.error("generateXiaoTReply failed after retries:", err);
    return null;
  }
}

// ---- Test seam ----
export const __internal = {
  parseJsonOutput,
  normalizeVerdict,
  normalizeSection,
  normalizeStringArray,
  extractText,
  fallbackDecision,
  shouldRetryLlm,
  HttpStatusError,
};
