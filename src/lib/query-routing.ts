function normalizePath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function toQueryRoute(pathname: string): string {
  const hashIdx = pathname.indexOf("#");
  const hash = hashIdx >= 0 ? pathname.slice(hashIdx) : "";
  const path = hashIdx >= 0 ? pathname.slice(0, hashIdx) : pathname;
  const normalized = normalizePath(path);
  if (normalized === "/") return `/${hash}`;
  return `/?${normalized.slice(1)}${hash}`;
}
