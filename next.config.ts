import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "sessionize.com" },
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

export default nextConfig;
