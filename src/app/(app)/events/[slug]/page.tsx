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

export async function generateStaticParams() {
  const slugs = new Set<string>(["placeholder", "event"]);

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

  return Array.from(slugs).map((slug) => ({ slug }));
}

export default function EventDetailPage() {
  return <EventDetailPageClient />;
}
