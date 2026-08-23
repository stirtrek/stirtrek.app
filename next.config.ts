import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},
  rewrites: async () => ({
    beforeFiles: [
      {
        source: "/apple-touch-icon.png",
        destination: "/api/apple-touch-icon",
      },
      {
        source: "/apple-touch-icon-precomposed.png",
        destination: "/api/apple-touch-icon",
      },
    ],
    afterFiles: [],
    fallback: [],
  }),
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "sessionize.com" },
      { protocol: "https", hostname: "cdn.sessionize.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "clubrunner.blob.core.windows.net" },
    ],
  },
  serverExternalPackages: [
    "@opentelemetry/sdk-node",
    "@opentelemetry/exporter-trace-otlp-proto",
    "@opentelemetry/exporter-metrics-otlp-proto",
    "@opentelemetry/exporter-logs-otlp-proto",
  ],
};

export default withSerwist(nextConfig);
