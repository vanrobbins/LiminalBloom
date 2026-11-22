import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev badge is bottom-right because bottom-left covers the tablet rail's
  // account button; it is hidden under Playwright (E2E) because bottom-right
  // covers the phone tabs' Account link.
  devIndicators: process.env.E2E ? false : { position: "bottom-right" },
  // Product images are shrunk in the browser to at most 2 MB (spec §5.4); the
  // default 1 MB action limit would refuse them. A little headroom for the form.
  experimental: { serverActions: { bodySizeLimit: "3mb" } },
  // Search merged into Products (Week 6.5 spec §2.1); old links keep their query.
  // Temporary (307): a 308 is cached forever. (The command palette, 0.7.0.8, didn't claim the word: it has no URL.)
  // People and Roles moved into the Store panel (0.7.0.7 spec section 2.1): `/store` and `/store/roles`.
  // Config redirects run before any page, so the guards there decide who sees what; 307 for the same reason.
  redirects: async () => [
    { source: "/search", destination: "/products", permanent: false },
    { source: "/people", destination: "/store", permanent: false },
    { source: "/roles", destination: "/store/roles", permanent: false },
  ],
};

export default nextConfig;
