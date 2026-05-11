import EventDetailPageClient from "./EventDetailPageClient";

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

type EventIndexItem = { slug?: string | null };
const EVENT_SLUG_FALLBACKS = ["placeholder", "event"] as const;

export async function generateStaticParams() {
  const slugs = new Set<string>(EVENT_SLUG_FALLBACKS);

  for (const baseUrl of resolveBaseUrls()) {
    try {
      const res = await fetch(`${baseUrl}/api/activities`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as { events?: EventIndexItem[] };
      for (const e of data.events ?? []) {
        if (e.slug) slugs.add(e.slug);
      }
      break;
    } catch (err) {
      console.warn(`generateStaticParams: failed to fetch events from ${baseUrl}`, err);
    }
  }

  if (slugs.size === EVENT_SLUG_FALLBACKS.length) {
    console.warn(
      "generateStaticParams: using only fallback event slugs; static export may miss real event detail pages",
    );
  }

  return Array.from(slugs).map((slug) => ({ slug }));
}

export default function EventDetailPage() {
  return <EventDetailPageClient />;
}
