"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * After React hydrates, reads the path saved by the not-found.tsx redirect
 * script and navigates to it via the Next.js client router.  This completes
 * the GitHub Pages SPA redirect trick so that real dynamic routes
 * (e.g. /events/[slug], /u/[handle]) work even though only placeholder HTML
 * files are pre-built.
 */
export function SpaRecovery() {
  const router = useRouter();

  useEffect(() => {
    try {
      const redirect = sessionStorage.getItem("_r");
      if (redirect) {
        sessionStorage.removeItem("_r");
        if (redirect !== location.pathname + location.search + location.hash) {
          router.replace(redirect);
        }
      }
    } catch {
      // sessionStorage unavailable (e.g. private browsing on some browsers)
    }
  }, [router]);

  return null;
}
