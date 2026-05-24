"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toQueryRoute } from "@/lib/query-routing";

export default function MeContactsPage() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace(toQueryRoute("/me/profile"));
  }, [router]);

  return null;
}
