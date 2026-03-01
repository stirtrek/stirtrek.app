import {
  trace,
  metrics,
  SpanKind,
  SpanStatusCode,
} from "@opentelemetry/api";
import { logs, SeverityNumber } from "@opentelemetry/api-logs";

const TRACER_NAME = "stirtrek-app";
const METER_NAME = "stirtrek-app";
const LOGGER_NAME = "stirtrek-app";

class TelemetryService {
  private tracer = trace.getTracer(TRACER_NAME);
  private meter = metrics.getMeter(METER_NAME);
  private logger = logs.getLogger(LOGGER_NAME);

  // Metrics
  private requestCounter = this.meter.createCounter("api.request.count", {
    description: "Total API requests",
  });

  private requestDuration = this.meter.createHistogram(
    "api.request.duration",
    { description: "API request duration in milliseconds", unit: "ms" },
  );

  private dbOperationDuration = this.meter.createHistogram(
    "database.operation.duration",
    { description: "Supabase operation duration in milliseconds", unit: "ms" },
  );

  private pushNotificationCounter = this.meter.createCounter(
    "push.notification.count",
    { description: "Push notifications sent" },
  );

  private emergencyMessageCounter = this.meter.createCounter(
    "emergency.message.count",
    { description: "Emergency messages created" },
  );

  private sessionizeSyncDuration = this.meter.createHistogram(
    "sessionize.sync.duration",
    { description: "Sessionize sync duration in milliseconds", unit: "ms" },
  );

  private authEventCounter = this.meter.createCounter("auth.event.count", {
    description: "Authentication events",
  });

  private leadCaptureCounter = this.meter.createCounter("lead.capture.count", {
    description: "Lead captures via QR scan",
  });

  private memoryGauge = this.meter.createObservableGauge(
    "system.memory.usage",
    { description: "Process memory usage in bytes", unit: "bytes" },
  );

  constructor() {
    this.memoryGauge.addCallback((result) => {
      const mem = process.memoryUsage();
      result.observe(mem.heapUsed, { type: "heap_used" });
      result.observe(mem.rss, { type: "rss" });
      result.observe(mem.external, { type: "external" });
    });
  }

  // Span helpers

  async trackAPIRoute<T>(
    routePath: string,
    method: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    return this.tracer.startActiveSpan(
      `API ${method} ${routePath}`,
      {
        kind: SpanKind.SERVER,
        attributes: { "http.route": routePath, "http.method": method },
      },
      async (span) => {
        try {
          const result = await fn();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: String(error),
          });
          span.recordException(error as Error);
          throw error;
        } finally {
          const duration = Date.now() - start;
          this.requestCounter.add(1, { route: routePath, method });
          this.requestDuration.record(duration, { route: routePath, method });
          span.end();
        }
      },
    );
  }

  async trackDatabaseOperation<T>(
    operation: string,
    table: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const start = Date.now();
    return this.tracer.startActiveSpan(
      `DB ${operation} ${table}`,
      {
        kind: SpanKind.CLIENT,
        attributes: {
          "db.system": "supabase",
          "db.operation": operation,
          "db.table": table,
        },
      },
      async (span) => {
        try {
          const result = await fn();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: String(error),
          });
          span.recordException(error as Error);
          throw error;
        } finally {
          const duration = Date.now() - start;
          this.dbOperationDuration.record(duration, { operation, table });
          span.end();
        }
      },
    );
  }

  trackAuthEvent(
    event: string,
    attributes: Record<string, string> = {},
  ): void {
    const span = this.tracer.startSpan(`Auth ${event}`, {
      kind: SpanKind.INTERNAL,
      attributes: { "auth.event": event, ...attributes },
    });
    this.authEventCounter.add(1, { event });
    span.end();
  }

  trackEmergencyMessage(
    action: "create" | "reply" | "status_change",
    attributes: Record<string, string> = {},
  ): void {
    const span = this.tracer.startSpan(`Emergency ${action}`, {
      kind: SpanKind.INTERNAL,
      attributes: { "emergency.action": action, ...attributes },
    });
    this.emergencyMessageCounter.add(1, { action });
    span.end();
  }

  trackPushNotification(
    target: "user" | "admins",
    recipientCount: number,
    attributes: Record<string, string> = {},
  ): void {
    const span = this.tracer.startSpan(`Push send to ${target}`, {
      kind: SpanKind.PRODUCER,
      attributes: {
        "push.target": target,
        "push.recipient_count": String(recipientCount),
        ...attributes,
      },
    });
    this.pushNotificationCounter.add(recipientCount, { target });
    span.end();
  }

  async trackSessionizeSync<T>(fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    return this.tracer.startActiveSpan(
      "Sessionize sync",
      { kind: SpanKind.CLIENT, attributes: { "sync.source": "sessionize" } },
      async (span) => {
        try {
          const result = await fn();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: String(error),
          });
          span.recordException(error as Error);
          throw error;
        } finally {
          const duration = Date.now() - start;
          this.sessionizeSyncDuration.record(duration);
          span.end();
        }
      },
    );
  }

  async trackSponsorSync<T>(fn: () => Promise<T>): Promise<T> {
    return this.tracer.startActiveSpan(
      "Sponsor feed sync",
      {
        kind: SpanKind.CLIENT,
        attributes: { "sync.source": "stirtrek-website" },
      },
      async (span) => {
        try {
          const result = await fn();
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: String(error),
          });
          span.recordException(error as Error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }

  trackLeadCapture(attributes: Record<string, string> = {}): void {
    const span = this.tracer.startSpan("Lead capture", {
      kind: SpanKind.INTERNAL,
      attributes: { ...attributes },
    });
    this.leadCaptureCounter.add(1);
    span.end();
  }

  // Structured logging

  private log(
    severityNumber: SeverityNumber,
    severityText: string,
    message: string,
    attributes: Record<string, unknown> = {},
  ): void {
    this.logger.emit({
      severityNumber,
      severityText,
      body: message,
      attributes: { ...attributes, "service.name": TRACER_NAME },
    });
  }

  logInfo(message: string, attributes: Record<string, unknown> = {}): void {
    this.log(SeverityNumber.INFO, "INFO", message, attributes);
  }

  logWarn(message: string, attributes: Record<string, unknown> = {}): void {
    this.log(SeverityNumber.WARN, "WARN", message, attributes);
  }

  logError(message: string, attributes: Record<string, unknown> = {}): void {
    this.log(SeverityNumber.ERROR, "ERROR", message, attributes);
  }

  logDebug(message: string, attributes: Record<string, unknown> = {}): void {
    this.log(SeverityNumber.DEBUG, "DEBUG", message, attributes);
  }
}

// No-op implementation for when telemetry is disabled
class NoOpTelemetryService {
  async trackAPIRoute<T>(
    _routePath: string,
    _method: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return fn();
  }
  async trackDatabaseOperation<T>(
    _operation: string,
    _table: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    return fn();
  }
  trackAuthEvent(): void {}
  trackEmergencyMessage(): void {}
  trackPushNotification(): void {}
  async trackSessionizeSync<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
  async trackSponsorSync<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }
  trackLeadCapture(): void {}
  logInfo(): void {}
  logWarn(): void {}
  logError(): void {}
  logDebug(): void {}
}

let instance: TelemetryService | NoOpTelemetryService | null = null;

export function getTelemetryService(): TelemetryService | NoOpTelemetryService {
  if (!instance) {
    const dtUrl = process.env.DYNATRACE_ENVIRONMENT_URL;
    const dtToken = process.env.DYNATRACE_API_TOKEN;
    instance =
      dtUrl && dtToken ? new TelemetryService() : new NoOpTelemetryService();
  }
  return instance;
}
