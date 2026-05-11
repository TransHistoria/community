import UserProfilePageClient from "./UserProfilePageClient";

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

type EventIndexItem = { organizer_handle?: string | null };

export async function generateStaticParams() {
  const handles = new Set<string>(["placeholder", "cyanmint"]);

  for (const baseUrl of resolveBaseUrls()) {
    try {
      const res = await fetch(`${baseUrl}/api/activities`, { cache: "no-store" });
      if (!res.ok) continue;
      const data = (await res.json()) as { events?: EventIndexItem[] };
      for (const e of data.events ?? []) {
        if (e.organizer_handle) handles.add(e.organizer_handle);
      }
      break;
    } catch {}
  }

  return Array.from(handles).map((handle) => ({ handle }));
}

export default function UserProfilePage() {
  return <UserProfilePageClient />;
}
