import type { ReactNode } from "react";
import { getEventStaticParams } from "@/lib/event-static";

export const generateStaticParams = getEventStaticParams;

export default function EventSlugLayout({ children }: { children: ReactNode }) {
  return children;
}
