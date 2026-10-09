import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Prisma + the pg driver adapter connect to Supabase Postgres (see
  // src/lib/db.ts) — keep them external so the serverless bundle includes the
  // real packages instead of a broken bundled copy.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
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
