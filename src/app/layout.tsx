import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { Inter, Source_Serif_4 } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast-context";
import { AuthProvider } from "@/contexts/AuthContext";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const serif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  weight: ["400", "500", "600"],
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "跨性别社群";

export const metadata: Metadata = {
  title: {
    default: appName,
    template: `%s · ${appName}`,
  },
  description: "私域跨性别社群活动平台 · 门槛清晰，隐私可控，按信任分层。",
  robots: { index: false, follow: false }, // private domain
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FAF7F2",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = process.env.NEXT_PUBLIC_APP_LOCALE ?? "zh-CN";
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const recoverFromPathQueryScript = `
    (function () {
      try {
        var raw = location.search || "";
        if (!raw || raw === "?") return;

        var pathCandidate = "";
        var safeDecode = function (value) {
          try {
            return decodeURIComponent(value);
          } catch (e) {
            return "";
          }
        };

        pathCandidate = safeDecode(raw.slice(1));
        if (!pathCandidate.startsWith("/")) pathCandidate = "/" + pathCandidate;
        if (!pathCandidate.startsWith("/") || pathCandidate.startsWith("//")) return;

        var bp = ${JSON.stringify(basePath)};
        if (bp && pathCandidate !== bp && !pathCandidate.startsWith(bp + "/")) {
          pathCandidate = bp + pathCandidate;
        }

        var targetUrl = new URL(pathCandidate, location.origin);
        if (targetUrl.origin !== location.origin) return;

        history.replaceState(null, "", targetUrl.pathname + targetUrl.search + targetUrl.hash);
      } catch (e) {}
    })();
  `;
  return (
    <html lang={locale} className={`${sans.variable} ${serif.variable}`}>
      <body>
        {/* Query-route recovery for static SPA entry: load `/?events/1`, `/?me`,
            `/?about` etc. and replace the URL before Next.js initialises. */}
        <script dangerouslySetInnerHTML={{ __html: recoverFromPathQueryScript }} />
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
