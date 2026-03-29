import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  // Only use static export in production; dev mode keeps API routes active
  ...(isDev ? {} : { output: "export" }),
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
