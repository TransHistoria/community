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
  return (
    <html lang={locale} className={`${sans.variable} ${serif.variable}`}>
      <body>
        {/* Runs synchronously before Next.js JS loads: reads the ?_spa= param
            written by the 404.html redirect script, sets window.__SPA_RECOVERED
            so the not-found script knows it is running inside the app rather
            than as a raw GitHub Pages 404, then calls history.replaceState so
            the router initialises with the correct URL (no RSC fetch needed). */}
        <script dangerouslySetInnerHTML={{ __html: "(function(){var p=new URLSearchParams(location.search).get('_spa');if(p){window.__SPA_RECOVERED=p;history.replaceState(null,'',p);}})();" }} />
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
