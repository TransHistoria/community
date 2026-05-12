function normalizePath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

export function toQueryRoute(pathname: string): string {
  const normalized = normalizePath(pathname);
  if (normalized === "/") return "/";
  return `/?${normalized.slice(1)}`;
}
