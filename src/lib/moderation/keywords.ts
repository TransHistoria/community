// Lightweight keyword filter for user-generated content.
// The list is intentionally small and conservative; it's a backstop, not a substitute for
// human moderation. Update as needed for community-specific terms.

const BLOCKED_PATTERNS: RegExp[] = [
  // contact-solicitation scams (case-insensitive)
  /(?:转账|借钱|微商|代理|刷单|包月|包夜|援交)/i,
  // wiretapping / blackmail
  /(?:威胁|爆照|开盒|人肉)/i,
  // sales spam
  /(?:加.{0,3}微信.{0,3}免费|私聊出售|出售.{0,3}号|低价办理)/i,
];

export function containsBlockedTerms(text: string): boolean {
  if (!text) return false;
  return BLOCKED_PATTERNS.some((re) => re.test(text));
}
