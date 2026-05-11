// GitHub Pages SPA redirect: when the static host serves this 404.html for
// an unknown path, the inline script fires synchronously before React
// hydrates, encodes the intended URL as a ?_spa= query param, and redirects
// to the app root.  The inline recovery script in the root layout body then
// calls history.replaceState before Next.js initialises, so the router
// sees the correct URL during initial hydration — no RSC payload fetch is
// triggered and the loop cannot happen.
//
// The window.__SPA_RECOVERED guard prevents this script from running when
// Next.js renders the not-found component client-side (e.g. after a failed
// navigation), which would otherwise re-trigger the redirect and loop.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const redirectScript = `(function(){try{if(window.__SPA_RECOVERED)return;var p=location.pathname+location.search+location.hash;location.replace(${JSON.stringify(basePath+"/")}+"?_spa="+encodeURIComponent(p));}catch(e){}})();`;

export const metadata = { title: "页面不存在" };

export default function NotFoundPage() {
  return (
    // biome-ignore lint: dangerouslySetInnerHTML is intentional here
    <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
  );
}
