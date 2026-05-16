// Lightweight keyword filter — mirrors src/lib/moderation/keywords.ts.
// This is a cheap backstop that runs before the (more expensive) LLM moderator.
// Update both files in lockstep when adding new patterns.

const BLOCKED_PATTERNS: RegExp[] = [
  /(?:转账|借钱|微商|代理|刷单|包月|包夜|援交)/i,
  /(?:威胁|爆照|开盒|人肉)/i,
  /(?:加.{0,3}微信.{0,3}免费|私聊出售|出售.{0,3}号|低价办理)/i,
];

export function containsBlockedTerms(text: string): boolean {
  if (!text) return false;
  return BLOCKED_PATTERNS.some((re) => re.test(text));
}
