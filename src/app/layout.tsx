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
        var safeDecodeURIComponent = function (value) {
          try {
            return decodeURIComponent(value);
          } catch (e) {
            return "";
          }
        };

        pathCandidate = safeDecodeURIComponent(raw.slice(1));
        if (!pathCandidate.startsWith("/")) pathCandidate = "/" + pathCandidate;
        if (!pathCandidate.startsWith("/") || pathCandidate.startsWith("//")) return;

        var bp = ${JSON.stringify(basePath)};
        if (bp && pathCandidate !== bp && !pathCandidate.startsWith(bp + "/")) {
          pathCandidate = bp + pathCandidate;
        }

        var mapClientRoute = function (inputPath) {
          var parsed = new URL(inputPath, location.origin);
          var pathname = parsed.pathname;
          var search = parsed.search || "";

          var stripBasePath = function (value) {
            if (!bp) return value;
            if (value === bp) return "/";
            if (value.startsWith(bp + "/")) return value.slice(bp.length);
            return value;
          };
          var withBasePath = function (value) {
            if (!bp || value === bp || value.startsWith(bp + "/")) return value;
            return bp + value;
          };

          var localPath = stripBasePath(pathname);
          var eventMatch = localPath.match(/^\/events\/([^/]+)$/);
          if (eventMatch) {
            return withBasePath("/events?slug=" + encodeURIComponent(eventMatch[1]));
          }

          var registerMatch = localPath.match(/^\/events\/([^/]+)\/register$/);
          if (registerMatch) {
            return withBasePath("/events/register?slug=" + encodeURIComponent(registerMatch[1]));
          }

          var editMatch = localPath.match(/^\/events\/([^/]+)\/edit$/);
          if (editMatch) {
            return withBasePath("/events/edit?slug=" + encodeURIComponent(editMatch[1]));
          }

          var manageMatch = localPath.match(/^\/events\/([^/]+)\/manage$/);
          if (manageMatch) {
            return withBasePath("/events/manage?slug=" + encodeURIComponent(manageMatch[1]));
          }

          var userMatch = localPath.match(/^\/u\/([^/]+)$/);
          if (userMatch) {
            return withBasePath("/u?handle=" + encodeURIComponent(userMatch[1]));
          }

          return pathname + search;
        };

        var targetUrl = new URL(mapClientRoute(pathCandidate), location.origin);
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
