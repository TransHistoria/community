import Link from "next/link";
import { env } from "@/lib/env";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 font-serif text-lg tracking-tight text-ink hover:text-ink/90"
    >
      <span
        aria-hidden
        className="inline-block h-5 w-5 rounded-full bg-trans-gradient ring-2 ring-bg-warm"
      />
      <span>{env.app.name}</span>
    </Link>
  );
}
