import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* Verification locale du build de production dans un dossier séparé :
     NEXT_DIST_DIR=.next-verify bunx next build  (n'affecte pas Vercel) */
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
