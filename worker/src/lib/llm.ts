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

export type EventCategory =
  | "PSYCH_SUPPORT"
  | "SOCIAL"
  | "SPORTS"
  | "ONLINE_GAMING"
  | "STUDY"
  | "WORKSHOP"
  | "ADVOCACY"
  | "OTHER";

export type EventFormat = "ONLINE" | "OFFLINE" | "HYBRID";

export type EventDraft = {
  title?: string;
  description?: string;
  category?: EventCategory;
  format?: EventFormat;
  /** ISO-8601 datetime string, e.g. 2026-06-21T14:00:00+08:00 */
  startAt?: string;
  endAt?: string;
  city?: string;
  preciseAddr?: string;
  onlineUrl?: string;
  capacity?: number;
};

/**
 * Distinguishes between "I'm organising a new activity" (needs TRUSTED+
 * activity-creation rights) and "I'm just talking about an activity"
 * (shared news, retrospective, discussion question — fine as a regular post).
 * Only set when section==="EVENT".
 */
export type EventIntent = "ORGANIZING" | "DISCUSSING";

export type ModerationDecision = {
  verdict: ModerationVerdict;
  reason: string;
  section: ModeratableSection;
  tags: string[];
  categories: string[];
  classifier: "LLM" | "FALLBACK";
  raw: string;
  /** Only populated when section==="EVENT". */
  eventIntent?: EventIntent;
  /** Only populated when section==="EVENT". Best-effort extraction from prose. */
  eventDraft?: EventDraft;
  /** True when eventDraft has every field needed to create a valid event row. */
  eventDraftComplete?: boolean;
  /** Human-readable Chinese labels of missing fields (for the user-facing prompt). */
  eventDraftMissing?: string[];
};

const REQUEST_TIMEOUT_MS = 15000;

const MOD_SYSTEM_PROMPT = `你是「跨性别社群」私域平台的内容审核与分类助手。

任务(一次性输出 JSON):

1) verdict — 内容是否违规
   - "reject": 明显违规(色情/约炮、药品/激素非法买卖、广告拉客、违法违规、人身攻击、仇恨言论)
   - "flag":  存在边界感、需要人工复核(轻微推销、个人色彩强烈的医生评价、隐含求购药物、紧急人身安全求助等)
   - "pass":  正常合规

2) section — 顶层归属
   - "EVENT":     涉及一个具体活动/聚会/线上会议(可以是组织、邀请,也可以是分享、回顾、讨论)
   - "MEDICAL":   涉及医疗、HRT、心理、医院、医生、医学知识、学术研究、个人就诊或用药经历
   - "RESOURCE":  提供或寻求帮助/技能/资源
   - "POST":      其他日常分享、心情、提问

3) tags — 从下面受控词表选 1~3 个最贴切:
   - medical-hospital-review, medical-science, medical-experience
   - resource-offer, resource-request
   - question-help, share-life, share-resource, announcement

4) categories — verdict 是 reject/flag 时填命中的违规分类标签(porn/hookup/drug/ad/illegal/attack 等)

5) 仅当 section==="EVENT" 时,**额外输出**:
   - eventIntent: 进一步区分作者意图
     * "ORGANIZING": 作者本人想发起一次具体的活动,在召集人来参加(有"我打算"/"邀请大家"/"扫码报名"/明确给出时间地点等信号)
     * "DISCUSSING": 作者只是分享、回顾、转发、提问某个活动(包括转发别人的活动信息、回忆刚参加完的聚会、咨询某活动的细节)。即便提到了时间/地点,只要作者不是在召集,就归到这里。
     判断时要谨慎,凡是不确定"作者要不要别人因此而来参加"的,默认 DISCUSSING。

   - eventDraft: 仅当 eventIntent==="ORGANIZING" 时填,一个对象,尽量从原文提取下列字段(无法提取就省略该字段):
     * title (必填,短标题)
     * description (必填,可在原文基础上稍作整理)
     * category: 从 PSYCH_SUPPORT/SOCIAL/SPORTS/ONLINE_GAMING/STUDY/WORKSHOP/ADVOCACY/OTHER 选一个
     * format: ONLINE / OFFLINE / HYBRID
     * startAt: ISO-8601 格式时间,带时区,如 "2026-06-21T14:00:00+08:00"。当前日期是 ${new Date().toISOString().slice(0, 10)},「这周六」「下个月3号」等相对时间请展开为绝对时间
     * endAt: 同上;若原文只给开始时间,可按 2 小时估算
     * city: OFFLINE/HYBRID 必填,城市名
     * preciseAddr: 精确地址(可选)
     * onlineUrl: 会议链接(可选)
     * capacity: 人数上限(可选)
   - eventDraftComplete: true 当且仅当 (title + description + category + format + startAt + endAt) 都有,且 format=OFFLINE/HYBRID 时 city 也有
   - eventDraftMissing: 中文字段名数组,列出缺少的必填字段(如 ["开始时间","城市"])。complete=true 时空数组。

约束:
- 即便用户没说自己想发到哪里,你也要给出最合适的 section。
- 不要因为「没填医院名」就拒绝医疗科普类内容。医疗科普/知识/学术/经验分享都允许 pass。
- 评论(kind=COMMENT)统一返回 section=POST,tags=[],不需要 eventDraft。

返回严格 JSON(不要 markdown 围栏、不要前后多余文字)。section!=EVENT 时不需要 eventIntent/eventDraft 字段:
{"verdict":"pass|flag|reject","reason":"一句中文","section":"...","tags":[...],"categories":[...],"eventIntent":"ORGANIZING|DISCUSSING","eventDraft":{...},"eventDraftComplete":bool,"eventDraftMissing":[...]}`;

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

const EVENT_CATEGORIES: EventCategory[] = [
  "PSYCH_SUPPORT", "SOCIAL", "SPORTS", "ONLINE_GAMING",
  "STUDY", "WORKSHOP", "ADVOCACY", "OTHER",
];
const EVENT_FORMATS: EventFormat[] = ["ONLINE", "OFFLINE", "HYBRID"];

function normalizeEventIntent(value: unknown): EventIntent | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.toUpperCase();
  if (v === "ORGANIZING" || v === "DISCUSSING") return v;
  return undefined;
}

function normalizeEventDraft(value: unknown): EventDraft | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const out: EventDraft = {};
  if (typeof v.title === "string" && v.title.trim()) out.title = v.title.trim().slice(0, 200);
  if (typeof v.description === "string" && v.description.trim())
    out.description = v.description.trim().slice(0, 8000);
  if (typeof v.category === "string") {
    const upper = v.category.toUpperCase() as EventCategory;
    if (EVENT_CATEGORIES.includes(upper)) out.category = upper;
  }
  if (typeof v.format === "string") {
    const upper = v.format.toUpperCase() as EventFormat;
    if (EVENT_FORMATS.includes(upper)) out.format = upper;
  }
  if (typeof v.startAt === "string" && !Number.isNaN(Date.parse(v.startAt))) out.startAt = v.startAt;
  if (typeof v.endAt === "string" && !Number.isNaN(Date.parse(v.endAt))) out.endAt = v.endAt;
  if (typeof v.city === "string" && v.city.trim()) out.city = v.city.trim().slice(0, 40);
  if (typeof v.preciseAddr === "string" && v.preciseAddr.trim())
    out.preciseAddr = v.preciseAddr.trim().slice(0, 200);
  if (typeof v.onlineUrl === "string" && v.onlineUrl.trim()) out.onlineUrl = v.onlineUrl.trim();
  if (typeof v.capacity === "number" && Number.isFinite(v.capacity) && v.capacity > 0)
    out.capacity = Math.min(10000, Math.floor(v.capacity));
  return Object.keys(out).length > 0 ? out : undefined;
}

function computeDraftCompleteness(
  draft: EventDraft | undefined,
): { complete: boolean; missing: string[] } {
  if (!draft) return { complete: false, missing: ["标题", "描述", "时间", "形式", "类别"] };
  const missing: string[] = [];
  if (!draft.title) missing.push("标题");
  if (!draft.description) missing.push("描述");
  if (!draft.category) missing.push("活动类别");
  if (!draft.format) missing.push("线上/线下");
  if (!draft.startAt) missing.push("开始时间");
  if (!draft.endAt) missing.push("结束时间");
  if ((draft.format === "OFFLINE" || draft.format === "HYBRID") && !draft.city) {
    missing.push("城市");
  }
  // End must be after start.
  if (draft.startAt && draft.endAt && Date.parse(draft.endAt) <= Date.parse(draft.startAt)) {
    missing.push("有效的时间范围(结束须晚于开始)");
  }
  return { complete: missing.length === 0, missing };
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
      // Generous token budget — deepseek-v4-flash spends a lot of its output
      // on the "thinking" block before emitting JSON; plus the full schema
      // (verdict + section + tags + categories + eventIntent + eventDraft)
      // can take 300+ tokens by itself. Keep room for both.
      () => callLLM(env, MOD_SYSTEM_PROMPT, buildModerationUserMessage(input), 9000),
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

  let eventIntent: EventIntent | undefined;
  let eventDraft: EventDraft | undefined;
  let eventDraftComplete: boolean | undefined;
  let eventDraftMissing: string[] | undefined;
  if (section === "EVENT") {
    // Default to DISCUSSING when the model omits intent — it's the safer
    // interpretation (we don't want to block VERIFIED users for talking
    // about an activity).
    eventIntent = normalizeEventIntent(parsed.eventIntent) ?? "DISCUSSING";
    if (eventIntent === "ORGANIZING") {
      eventDraft = normalizeEventDraft(parsed.eventDraft);
      const overrideComplete = typeof parsed.eventDraftComplete === "boolean"
        ? parsed.eventDraftComplete
        : undefined;
      const computed = computeDraftCompleteness(eventDraft);
      eventDraftComplete = overrideComplete ?? computed.complete;
      eventDraftMissing = Array.isArray(parsed.eventDraftMissing)
        ? parsed.eventDraftMissing.filter((s): s is string => typeof s === "string").slice(0, 10)
        : computed.missing;
      if (eventDraftComplete && computed.missing.length > 0) {
        eventDraftComplete = false;
        eventDraftMissing = computed.missing;
      }
    }
  }

  return {
    verdict,
    reason,
    section,
    tags,
    categories,
    classifier: "LLM",
    raw,
    eventIntent,
    eventDraft,
    eventDraftComplete,
    eventDraftMissing,
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

// ============================================================
// Report evaluation — LLM decides whether an incoming report is
// (a) clearly valid → hide the target;
// (b) clearly invalid → dismiss the report;
// (c) uncertain → escalate to admin.
// USER-type reports always escalate; we never let the model auto-suspend
// an account.
// ============================================================

export type ReportTargetKind = "USER" | "POST" | "EVENT" | "COMMENT";

export type ReportEvaluation = {
  verdict: "valid" | "invalid" | "uncertain";
  action: "hide_target" | "dismiss" | "escalate";
  reason: string;
  classifier: "LLM" | "FALLBACK";
  raw: string;
};

const REPORT_SYSTEM_PROMPT = `你是「跨性别社群」的举报审核助手。

输入会给你:
- targetType: USER | POST | EVENT | COMMENT
- 被举报内容的标题和正文(USER 类型时是简介和 handle)
- 举报理由

任务: 判断举报是否成立,输出严格 JSON:
{
  "verdict": "valid" | "invalid" | "uncertain",
  "action":  "hide_target" | "dismiss" | "escalate",
  "reason":  "一句中文,会展示给被举报人和举报人"
}

判定规则:
- valid + hide_target: 被举报内容**明显违规**(色情/约炮/广告/药品交易/人身攻击/仇恨言论/泄露他人隐私等)。自动隐藏。
- invalid + dismiss: 内容合规,举报不成立。关闭举报,通知举报人。
- uncertain + escalate: 任何模糊/争议/上下文敏感的情况。包括:
  * 个人冲突类(双方各执一词)
  * 医生/医院评价(可能是真实负面体验)
  * 政治、性别身份相关的尖锐观点
  * 看似攻击但其实是讨论
  * 你无法在缺乏上下文的情况下判断时

特别约束:
- USER 类型举报永远 escalate,不让 AI 自动封号
- 即便内容看似冒犯,如果只是观点表达而非攻击具体的人,默认 escalate
- 宁可 escalate 也别 false positive

返回严格 JSON,无 markdown 围栏。`;

function normalizeReportVerdict(value: unknown): ReportEvaluation["verdict"] | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase();
  if (v === "valid" || v === "invalid" || v === "uncertain") return v;
  return null;
}

function normalizeReportAction(value: unknown): ReportEvaluation["action"] | null {
  if (typeof value !== "string") return null;
  const v = value.toLowerCase();
  if (v === "hide_target" || v === "dismiss" || v === "escalate") return v;
  return null;
}

function fallbackReportEval(reason: string): ReportEvaluation {
  return {
    verdict: "uncertain",
    action: "escalate",
    reason,
    classifier: "FALLBACK",
    raw: "",
  };
}

export async function evaluateReport(
  env: Env,
  input: {
    targetType: ReportTargetKind;
    targetTitle?: string;
    targetBody: string;
    reason: string;
  },
): Promise<ReportEvaluation> {
  // USER reports always escalate.
  if (input.targetType === "USER") {
    return {
      verdict: "uncertain",
      action: "escalate",
      reason: "用户类型举报需要管理员人工处理。",
      classifier: "FALLBACK",
      raw: "",
    };
  }

  if (!(env.LLM_API_KEY ?? "").trim()) {
    return fallbackReportEval("LLM 未配置,已转人工审核");
  }

  const userMessage = [
    `targetType: ${input.targetType}`,
    input.targetTitle ? `targetTitle: ${input.targetTitle.slice(0, 300)}` : null,
    `targetBody: ${input.targetBody.slice(0, 4000)}`,
    `reportReason: ${input.reason.slice(0, 1000)}`,
  ]
    .filter((s): s is string => !!s)
    .join("\n");

  let text: string;
  let raw: string;
  try {
    const result = await withRetry(
      () => callLLM(env, REPORT_SYSTEM_PROMPT, userMessage, 4000),
      { label: "report-eval", shouldRetry: shouldRetryLlm },
    );
    text = result.text;
    raw = result.raw;
  } catch (err) {
    console.error("evaluateReport failed after retries:", err);
    return fallbackReportEval("审核服务暂不可用,已转人工审核");
  }

  if (!text) return { ...fallbackReportEval("审核服务返回空,已转人工审核"), raw };
  const parsed = parseJsonOutput(text);
  if (!parsed) return { ...fallbackReportEval("审核结果格式异常,已转人工审核"), raw };

  const verdict = normalizeReportVerdict(parsed.verdict);
  const action = normalizeReportAction(parsed.action);
  if (!verdict || !action) {
    return { ...fallbackReportEval("审核结果缺失关键字段,已转人工审核"), raw };
  }
  const reason =
    typeof parsed.reason === "string" && parsed.reason.trim()
      ? parsed.reason.trim().slice(0, 500)
      : verdict === "valid"
        ? "经 AI 审核,举报成立,已自动处理"
        : verdict === "invalid"
          ? "经 AI 审核,内容合规,举报不成立"
          : "经 AI 审核,需要人工进一步判断";

  return { verdict, action, reason, classifier: "LLM", raw };
}

// ---- Test seam ----
export const __internal = {
  parseJsonOutput,
  normalizeVerdict,
  normalizeSection,
  normalizeStringArray,
  normalizeEventIntent,
  normalizeEventDraft,
  computeDraftCompleteness,
  extractText,
  fallbackDecision,
  shouldRetryLlm,
  HttpStatusError,
  normalizeReportVerdict,
  normalizeReportAction,
  fallbackReportEval,
};
