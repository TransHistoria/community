import Link from "next/link";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "TransHistoria";

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
      <span>{APP_NAME}</span>
    </Link>
  );
}
