import { Suspense } from "react";
import { VerifyMagicLinkClient } from "./VerifyMagicLinkClient";

export const metadata = { title: "验证登录链接" };

export default function VerifySignInPage() {
  return (
    <Suspense>
      <VerifyMagicLinkClient />
    </Suspense>
  );
}
