import type { ReactNode } from "react";

export function generateStaticParams() {
  return [{ slug: "placeholder" }];
}

export default function EventSlugLayout({ children }: { children: ReactNode }) {
  return children;
}
