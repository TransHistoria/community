const LEGACY_WORKER_URL = "https://transcommunity.cyanmint.workers.dev";

function normalizeUrl(url?: string): string {
  return (url || "").trim().replace(/\/$/, "");
}

function resolveBaseUrls(): string[] {
  const candidates = [
    normalizeUrl(process.env.NEXT_PUBLIC_API_URL),
    normalizeUrl(process.env.NEXT_PUBLIC_API_FALLBACK_URL),
    LEGACY_WORKER_URL,
  ];
  return candidates.filter((url, i) => !!url && candidates.indexOf(url) === i);
}

type EventIndexItem = { id?: string | null; slug?: string | null };

/**
 * Shared helper used by all /events/[slug]/* pages to produce generateStaticParams.
 * Pre-generates shells only for events that currently exist in the API; any event
 * created after the last build can still be reached via query-route SPA entry
 * URLs (for example `/?event/1` / `/?path=/event/1`).
 * No numeric ID fallbacks — event IDs are CUIDs, not integers.
 */
export async function getEventStaticParams(): Promise<Array<{ slug: string }>> {
  const slugs = new Set<string>(["placeholder"]);

  for (const baseUrl of resolveBaseUrls()) {
    try {
      const res = await fetch(`${baseUrl}/api/activities`, { cache: "force-cache" });
      if (!res.ok) continue;
      const data = (await res.json()) as { events?: EventIndexItem[] };
      for (const e of data.events ?? []) {
        if (e.id) slugs.add(e.id);
        if (e.slug) slugs.add(e.slug);
      }
      break;
    } catch (err) {
      console.warn(`getEventStaticParams: failed to fetch events from ${baseUrl}`, err);
    }
  }

  return Array.from(slugs).map((slug) => ({ slug }));
}
