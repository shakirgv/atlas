import type { NextConfig } from "next";

// Cache Components is intentionally disabled: every page in Atlas is private,
// per-user and request-time (cookies + Supabase session), so the classic
// dynamic rendering model is simpler and avoids Suspense-boundary build errors.
const nextConfig: NextConfig = {
  experimental: {
    // Going back to a page seen in the last 30 seconds reuses what the browser has. Saving anything clears it (refreshAll).
    staleTimes: { dynamic: 30 },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["sharp"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      // Later rules win. Public share pages: never indexed, never leak the URL as a referrer.
      {
        source: "/s/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
      { source: "/s/:token", headers: [{ key: "Cache-Control", value: "private, no-store" }] },
    ];
  },
};

export default nextConfig;
