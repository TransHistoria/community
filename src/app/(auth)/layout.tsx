import { Logo } from "@/components/layout/Logo";
import Link from "next/link";
import { toQueryRoute } from "@/lib/query-routing";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-bg-warm">
      <header className="container flex h-16 items-center justify-between">
        <Logo />
        <Link
          href={toQueryRoute("/about")}
          className="text-sm text-ink-muted hover:text-ink"
        >
          关于平台
        </Link>
      </header>
      <main className="flex-1 flex items-start justify-center py-12 px-4">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
