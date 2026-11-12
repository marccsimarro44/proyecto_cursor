import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PromptShield ships as a fully static site: no server, no API routes.
  // Cache Components / Partial Prefetching are left off on purpose: they rely
  // on PPR, which Next.js rejects in export mode.
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
