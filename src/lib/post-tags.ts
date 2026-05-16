// Centralized tag vocabulary used by the LLM and rendered in the UI.
// Keep in sync with the controlled list inside worker/src/lib/llm.ts.

export const POST_TAGS = [
  "medical-hospital-review",
  "medical-science",
  "medical-experience",
  "resource-offer",
  "resource-request",
  "question-help",
  "share-life",
  "share-resource",
  "announcement",
] as const;

export type PostTag = (typeof POST_TAGS)[number];

export const TAG_LABEL: Record<string, string> = {
  "medical-hospital-review": "医院点评",
  "medical-science": "医疗科普",
  "medical-experience": "就诊经验",
  "resource-offer": "我可提供",
  "resource-request": "我求助",
  "question-help": "提问求助",
  "share-life": "生活分享",
  "share-resource": "资源推荐",
  announcement: "通知",
};

// Top-level tabs shown on /posts. Each one filters by a single tag (or a tag prefix).
export const TAG_TABS: { key: string; label: string; tag?: string }[] = [
  { key: "all", label: "全部" },
  { key: "question-help", label: "提问求助", tag: "question-help" },
  { key: "medical", label: "医疗", tag: "medical-" },
  { key: "resource", label: "资源", tag: "resource-" },
  { key: "share", label: "分享", tag: "share-" },
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
