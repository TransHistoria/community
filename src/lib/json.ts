// Tiny helpers to keep DB Json fields safe through SQLite's TEXT storage.
//
// SQLite (used for local dev) doesn't support a Json column, so the schema
// stores these fields as `String`. Wrap reads/writes through these helpers so
// the swap is one-line if you switch back to Postgres jsonb later.

export function jsonEncode(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function jsonEncodeNullable(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

export function jsonDecode<T = unknown>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
