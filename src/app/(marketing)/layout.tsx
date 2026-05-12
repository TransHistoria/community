import { Suspense } from "react";
import QueryLayoutShell from "./QueryLayoutShell";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense>
      <QueryLayoutShell>{children}</QueryLayoutShell>
    </Suspense>
  );
}
