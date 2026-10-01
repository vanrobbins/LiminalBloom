import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-only route badge defaults to bottom-left, where it sits on top of
  // the tablet rail's account button and swallows clicks.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
