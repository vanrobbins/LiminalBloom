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
  // Temporary (307): a 308 is cached forever, and the command palette may claim the word.
  redirects: async () => [{ source: "/search", destination: "/products", permanent: false }],
};

export default nextConfig;
