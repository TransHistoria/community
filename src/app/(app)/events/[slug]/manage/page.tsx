import ManageEventPageClient from "./ManageEventPageClient";
import { getEventStaticParams } from "@/lib/event-static";

export const generateStaticParams = getEventStaticParams;

export default function ManageEventPage() {
  return <ManageEventPageClient />;
}
