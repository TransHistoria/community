"use client";

import { Suspense } from "react";
import { VerifyMagicLinkClient } from "./VerifyMagicLinkClient";

export default function VerifySignInPageClient() {
  return (
    <Suspense>
      <VerifyMagicLinkClient />
    </Suspense>
  );
}
