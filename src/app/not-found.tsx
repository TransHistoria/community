// GitHub Pages SPA redirect: when the static host serves this 404.html for
// an unknown path, the inline script fires synchronously before React
// hydrates, encodes the intended URL as a ?_spa= query param, and redirects
// to the app root.  The inline recovery script in the root layout body then
// calls history.replaceState before Next.js initialises, so the router
// sees the correct URL during initial hydration — no RSC payload fetch is
// triggered.
//
// The window.__SPA_RECOVERED guard prevents an infinite loop: it stores the
// path that was recovered, and the redirect only fires when the current path
// differs from the recovered path.  This allows navigating to a different
// non-pre-generated route after a recovery (e.g. clicking between event
// pages) while still preventing the redirect from looping on the same path.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const redirectScript = `(function(){try{var p=location.pathname+location.search+location.hash;if(window.__SPA_RECOVERED===p)return;location.replace(${JSON.stringify(basePath+"/")}+"?_spa="+encodeURIComponent(p));}catch(e){}})();`;

export const metadata = { title: "页面不存在" };

export default function NotFoundPage() {
  return (
    // biome-ignore lint: dangerouslySetInnerHTML is intentional here
    <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
  );
}
