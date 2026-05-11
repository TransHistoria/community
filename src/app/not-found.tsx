// GitHub Pages SPA redirect: when the static host serves this 404.html for
// an unknown path, the inline script fires synchronously before React
// hydrates, stores the intended URL in sessionStorage, and redirects to the
// app root.  SpaRecovery in the root layout then restores the URL so the
// Next.js client router can navigate to the correct page.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const redirectScript = `(function(){try{sessionStorage.setItem('_r',location.pathname+location.search+location.hash);}catch(e){}location.replace(${JSON.stringify(basePath + "/")});})();`;

export const metadata = { title: "页面不存在" };

export default function NotFoundPage() {
  return (
    // This script runs synchronously during HTML parsing and redirects to root.
    // Browsers without JS will see a blank page (acceptable for a private SPA).
    // biome-ignore lint: dangerouslySetInnerHTML is intentional here
    <script dangerouslySetInnerHTML={{ __html: redirectScript }} />
  );
}
