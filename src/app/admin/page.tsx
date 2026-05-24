"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toQueryRoute } from "@/lib/query-routing";

export default function AdminIndex() {
  const router = useRouter();

  useEffect(() => {
    router.replace(toQueryRoute("/admin/applications"));
  }, [router]);

  return null;
}
