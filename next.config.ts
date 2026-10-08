import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Defect D: the circular "N" badge in the bottom corner was the Next.js dev
  // tools indicator (enabled by default in dev). Disabled at the framework
  // level — it never appears in production builds; this also removes it from
  // dev so screenshots/QA reflect the real UI.
  devIndicators: false,
};

export default nextConfig;
