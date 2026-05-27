// Centralized tag vocabulary used by the LLM and rendered in the UI.
// Keep in sync with the controlled list inside worker/src/lib/llm.ts.

export const POST_TAGS = [
  "question-help",
  "offline-meetup",
  "medical-hospital-review",
  "medical-science",
  "medical-experience",
  "resource-offer",
  "resource-request",
  "reflection",
] as const;

export type PostTag = (typeof POST_TAGS)[number];

export const TAG_LABEL: Record<string, string> = {
  "question-help": "提问求助",
  "offline-meetup": "线下交友",
  "medical-hospital-review": "医院点评",
  "medical-science": "医疗科普",
  "medical-experience": "就诊经验",
  "resource-offer": "我可提供",
  "resource-request": "我求助",
  reflection: "感悟",
};

// Top-level tabs shown on /posts. Each one filters by a single tag (or a tag prefix).
export const TAG_TABS: { key: string; label: string; tag?: string }[] = [
  { key: "all", label: "全部" },
  { key: "question-help", label: "提问求助", tag: "question-help" },
  { key: "offline-meetup", label: "线下交友", tag: "offline-meetup" },
  { key: "medical", label: "医疗信息", tag: "medical-" },
  { key: "resource", label: "资源分享", tag: "resource-" },
  { key: "reflection", label: "感悟", tag: "reflection" },
];

export function parsePostTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter((t): t is string => typeof t === "string");
  } catch {
    // ignore
  }
  return [];
}
