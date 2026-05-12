import EditEventPageClient from "./EditEventPageClient";
import { getEventStaticParams } from "@/lib/event-static";

export const metadata = { title: "编辑活动" };
export const generateStaticParams = getEventStaticParams;

export default function EditEventPage() {
  return <EditEventPageClient />;
}
