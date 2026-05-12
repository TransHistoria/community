function normalizePath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) return "/";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

type SearchParamsLike = {
  entries(): IterableIterator<[string, string]>;
};

export function getQueryRoute(searchParams: SearchParamsLike): {
  path: string;
  params: URLSearchParams;
} {
  let path = "";
  const params = new URLSearchParams();
  let isFirst = true;

  for (const [key, value] of searchParams.entries()) {
    if (isFirst) {
      isFirst = false;
      const nestedQueryIdx = key.indexOf("?");
      const routeKey = nestedQueryIdx >= 0 ? key.slice(0, nestedQueryIdx) : key;
      path = routeKey ? normalizePath(routeKey) : "";

      if (nestedQueryIdx >= 0) {
        params.append(key.slice(nestedQueryIdx + 1), value);
      }
      continue;
    }

    params.append(key, value);
  }

  return { path, params };
}

export function toQueryRoute(pathname: string): string {
  const hashIdx = pathname.indexOf("#");
  const hash = hashIdx >= 0 ? pathname.slice(hashIdx) : "";
  const withNoHash = hashIdx >= 0 ? pathname.slice(0, hashIdx) : pathname;
  const searchIdx = withNoHash.indexOf("?");
  const search = searchIdx >= 0 ? withNoHash.slice(searchIdx + 1) : "";
  const path = searchIdx >= 0 ? withNoHash.slice(0, searchIdx) : withNoHash;
  const normalized = normalizePath(path);

  if (normalized === "/") {
    return search ? `/?${search}${hash}` : `/${hash}`;
  }

  return `/?${normalized.slice(1)}${search ? `&${search}` : ""}${hash}`;
}
