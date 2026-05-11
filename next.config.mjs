/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fully static export — served from GitHub Pages.
  output: "export",

  // GitHub Pages serves the site under a sub-path when the repo is not the
  // root page.  Set NEXT_PUBLIC_BASE_PATH to "/community" (or whatever the
  // repo name is) in CI; leave empty for custom-domain deployments.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? "",

  reactStrictMode: true,

  // Static export does not support server actions; all mutations go through
  // the Cloudflare Worker API (NEXT_PUBLIC_API_URL).
  experimental: {},

  // next/image requires a loader for static export.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
