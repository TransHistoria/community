import Link from "next/link";

export function Footer() {
  return (
    <footer className="hidden md:block border-t border-border bg-bg-warm/60">
      <div className="container py-10 grid gap-8 md:grid-cols-3">
        <div className="space-y-2">
          <div className="font-serif text-h3 tracking-tight">跨性别社群</div>
          <p className="text-sm text-ink-muted max-w-xs">私域跨性别社群活动平台。门槛清晰，隐私可控，按信任分层。</p>
        </div>
        <nav className="grid grid-cols-2 gap-2 text-sm text-ink-muted">
          <Link href="/about" className="hover:text-ink">关于平台</Link>
          <Link href="/about#community-guidelines" className="hover:text-ink">社区守则</Link>
          <Link href="/about#privacy" className="hover:text-ink">隐私承诺</Link>
          <Link href="/about#safety" className="hover:text-ink">安全提示</Link>
        </nav>
        <div className="text-xs text-ink-subtle space-y-1.5">
          <p>本平台不提供私信功能。任何要求转账、提供证件的请求请保持警惕。</p>
          <p>遇到不当内容或行为，请使用页面上的「举报」入口。</p>
        </div>
      </div>
    </footer>
  );
}
