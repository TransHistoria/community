import EventDetailPageClient from "./EventDetailPageClient";
import { getEventStaticParams } from "@/lib/event-static";

export const generateStaticParams = getEventStaticParams;

export default function EventDetailPage() {
  return <EventDetailPageClient />;
}
