import { NextRequest, NextResponse } from "next/server";
import { syncSessionizeData } from "@/lib/sessionize/sync";
import { getTelemetryService } from "@/lib/telemetry/service";

export async function GET(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/cron/sessionize-sync",
    "GET",
    async () => {
      const authHeader = request.headers.get("authorization");

      if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const result = await syncSessionizeData();

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      return NextResponse.json(result);
    },
  );
}
