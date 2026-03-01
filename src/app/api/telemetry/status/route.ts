import { NextResponse } from "next/server";

export async function GET() {
  const dtUrl = process.env.DYNATRACE_ENVIRONMENT_URL;
  const dtToken = process.env.DYNATRACE_API_TOKEN;
  const isConfigured = Boolean(dtUrl && dtToken);

  return NextResponse.json({
    telemetry: {
      enabled: isConfigured,
      provider: isConfigured ? "dynatrace" : "none",
      endpoint: isConfigured ? dtUrl : null,
      serviceName: process.env.OTEL_SERVICE_NAME || "stirtrek-app",
      environment:
        process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
      region: process.env.VERCEL_REGION || "local",
      runtime: "nodejs",
    },
    timestamp: new Date().toISOString(),
  });
}
