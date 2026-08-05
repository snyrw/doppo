import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Backstop for project saves; unbounded payloads (attention patterns) are
  // stored by reference instead, not raised to fit here.
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
