import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Keep dev (`next dev`) and production (`next build`) caches separate so
  // running a build while the dev server is up cannot break CSS again.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  outputFileTracingRoot: path.join(appDir, "../.."),
  transpilePackages: ["@medcounsel/database", "@medcounsel/prediction-engine", "@medcounsel/types"],
};

export default nextConfig;
