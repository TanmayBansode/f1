import type { NextConfig } from "next";

// output:export is only used when building the static site for deployment.
// The admin panel's API routes require a Node.js server, so they are excluded
// from the static export. Run `npm run export` instead of `npm run build`
// when you need the static bundle.
const isStaticExport = process.env.STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  ...(isStaticExport ? { output: "export" } : {}),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
