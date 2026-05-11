import EventDetailPageClient from "./EventDetailPageClient";

export function generateStaticParams() {
  return [{ slug: "placeholder" }];
}

export default function EventDetailPage() {
  return <EventDetailPageClient />;
}
