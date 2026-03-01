import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchLogRecordProcessor } from "@opentelemetry/sdk-logs";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-node";

let sdk: NodeSDK | null = null;

export function initTelemetry(): void {
  if (sdk) return;

  const dtUrl = process.env.DYNATRACE_ENVIRONMENT_URL;
  const dtToken = process.env.DYNATRACE_API_TOKEN;

  if (!dtUrl || !dtToken) {
    console.log(
      "[Telemetry] DYNATRACE_ENVIRONMENT_URL or DYNATRACE_API_TOKEN not set. Telemetry disabled.",
    );
    return;
  }

  const headers = { Authorization: `Api-Token ${dtToken}` };
  const serviceName = process.env.OTEL_SERVICE_NAME || "stirtrek-app";
  const serviceVersion = process.env.npm_package_version || "0.1.0";
  const environment =
    process.env.VERCEL_ENV || process.env.NODE_ENV || "development";

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
    "service.instance.id": process.env.VERCEL_REGION || "local",
  });

  const traceExporter = new OTLPTraceExporter({
    url: `${dtUrl}/api/v2/otlp/v1/traces`,
    headers,
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${dtUrl}/api/v2/otlp/v1/metrics`,
    headers,
  });

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 15_000,
  });

  const logExporter = new OTLPLogExporter({
    url: `${dtUrl}/api/v2/otlp/v1/logs`,
    headers,
  });

  sdk = new NodeSDK({
    resource,
    spanProcessors: [
      new BatchSpanProcessor(traceExporter, {
        maxQueueSize: 512,
        maxExportBatchSize: 128,
        scheduledDelayMillis: 5_000,
      }),
    ],
    metricReader,
    logRecordProcessors: [
      new BatchLogRecordProcessor(logExporter, {
        maxQueueSize: 512,
        maxExportBatchSize: 128,
        scheduledDelayMillis: 5_000,
      }),
    ],
    instrumentations: [
      new HttpInstrumentation({
        ignoreIncomingRequestHook: (req) => {
          const url = req.url || "";
          return (
            url.startsWith("/_next/") ||
            url.startsWith("/icons/") ||
            url.startsWith("/images/") ||
            url === "/favicon.ico" ||
            url === "/sw.js"
          );
        },
      }),
      new FetchInstrumentation(),
    ],
  });

  sdk.start();

  const shutdown = async () => {
    try {
      await sdk?.shutdown();
    } catch (e) {
      console.error("[Telemetry] Error during shutdown:", e);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  console.log(
    `[Telemetry] Initialized for ${serviceName}@${serviceVersion} (${environment})`,
  );
}
