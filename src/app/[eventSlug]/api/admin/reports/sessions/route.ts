import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import {
  getEventId,
  requireEventAdmin,
  isErrorResponse,
  safeParseBody,
} from "@/lib/events/api-helpers";
import { sendEmail } from "@/lib/email";

function escapeCsv(field: string | number | null | undefined): string {
  if (field === null || field === undefined) return "";
  const s = String(field);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute(
    "/api/admin/reports/sessions",
    "POST",
    async () => {
      const eventId = getEventId(request);
      const auth = await requireEventAdmin(eventId);
      if (isErrorResponse(auth)) return auth;

      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        return NextResponse.json(
          { error: "Your account has no email address on file" },
          { status: 400 },
        );
      }

      const body = await safeParseBody<{ recipient?: string }>(request);
      if (body instanceof NextResponse) return body;
      const recipient = (body?.recipient?.trim() || user.email).toLowerCase();
      // Basic shape check; Resend will reject anything obviously bogus too.
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        return NextResponse.json(
          { error: "Invalid recipient email" },
          { status: 400 },
        );
      }

      const admin = createAdminClient();

      // 1) Event metadata (for filename, From address, subject)
      const { data: eventRecord } = await admin
        .from("events")
        .select("slug, name, short_name, domain")
        .eq("id", eventId)
        .single();
      const slug = eventRecord?.slug ?? "event";
      const eventName =
        eventRecord?.name ?? eventRecord?.short_name ?? "the event";

      // 2) Sessions (non-service) with room info embedded
      const { data: sessionsRaw, error: sessionsErr } = await admin
        .from("sessions")
        .select(
          "id, title, starts_at, ends_at, room_id, rooms(name, sort_order)",
        )
        .eq("event_id", eventId)
        .eq("is_service_session", false)
        .order("starts_at", { ascending: true });
      if (sessionsErr) {
        return NextResponse.json(
          { error: `sessions: ${sessionsErr.message}` },
          { status: 500 },
        );
      }
      type Session = {
        id: string;
        title: string;
        starts_at: string;
        ends_at: string | null;
        room_id: number | null;
        rooms: { name: string; sort_order: number } | null;
      };
      const sessions = (sessionsRaw ?? []) as unknown as Session[];

      if (sessions.length === 0) {
        return NextResponse.json(
          { error: "No sessions found for this event" },
          { status: 400 },
        );
      }

      // 3) Speakers per session
      const { data: spkRowsRaw } = await admin
        .from("session_speakers")
        .select("session_id, speakers(full_name)")
        .eq("event_id", eventId);
      const speakersBySession = new Map<string, string[]>();
      for (const r of (spkRowsRaw ?? []) as unknown as {
        session_id: string;
        speakers: { full_name: string } | null;
      }[]) {
        if (!r.speakers?.full_name) continue;
        const list = speakersBySession.get(r.session_id) ?? [];
        list.push(r.speakers.full_name);
        speakersBySession.set(r.session_id, list);
      }

      // 4) Attendance counts (room × time-slot)
      const { data: attendanceRows } = await admin
        .from("attendance_counts")
        .select("room_id, time_slot, count")
        .eq("event_id", eventId);
      const attendanceKey = (roomId: number, timeSlot: string) =>
        `${roomId}|${new Date(timeSlot).toISOString()}`;
      const attendanceByKey = new Map<string, number>();
      for (const a of attendanceRows ?? []) {
        attendanceByKey.set(
          attendanceKey(a.room_id as number, a.time_slot as string),
          a.count as number,
        );
      }

      // 5) Simulcast mapping (source room → target rooms)
      const { data: simRows } = await admin
        .from("simulcast_rooms")
        .select("source_room_id, target_room_id")
        .eq("event_id", eventId);
      const simulcastTargets = new Map<number, number[]>();
      for (const s of simRows ?? []) {
        const list = simulcastTargets.get(s.source_room_id as number) ?? [];
        list.push(s.target_room_id as number);
        simulcastTargets.set(s.source_room_id as number, list);
      }

      // 6) Feedback for these sessions
      const sessionIds = sessions.map((s) => s.id);
      const { data: feedbackRows } = await admin
        .from("session_feedback")
        .select("session_id, rating, comment")
        .eq("event_id", eventId)
        .in("session_id", sessionIds);
      type FbAgg = {
        total: number;
        green: number;
        yellow: number;
        red: number;
        comments: string[];
      };
      const fbBySession = new Map<string, FbAgg>();
      for (const f of feedbackRows ?? []) {
        const sid = f.session_id as string;
        const agg = fbBySession.get(sid) ?? {
          total: 0,
          green: 0,
          yellow: 0,
          red: 0,
          comments: [],
        };
        agg.total += 1;
        const rating = f.rating as "green" | "yellow" | "red";
        if (rating === "green") agg.green += 1;
        else if (rating === "yellow") agg.yellow += 1;
        else if (rating === "red") agg.red += 1;
        const c = (f.comment as string | null)?.trim();
        if (c) agg.comments.push(c);
        fbBySession.set(sid, agg);
      }

      // 7) Build CSV
      const header = [
        "Starts At",
        "Ends At",
        "Room",
        "Title",
        "Speakers",
        "Primary Attendance",
        "Simulcast Attendance",
        "Total Attendance",
        "Ratings Total",
        "Green",
        "Yellow",
        "Red",
        "Comment Count",
        "Comments",
      ];

      const rows = sessions.map((s) => {
        const speakers = (speakersBySession.get(s.id) ?? [])
          .slice()
          .sort()
          .join(", ");

        const primary =
          s.room_id != null && s.starts_at
            ? (attendanceByKey.get(attendanceKey(s.room_id, s.starts_at)) ?? 0)
            : 0;

        let simulcast = 0;
        if (s.room_id != null && s.starts_at) {
          for (const tgt of simulcastTargets.get(s.room_id) ?? []) {
            simulcast +=
              attendanceByKey.get(attendanceKey(tgt, s.starts_at)) ?? 0;
          }
        }

        const fb = fbBySession.get(s.id);
        const allComments = (fb?.comments ?? []).join("  |||  ");

        return [
          s.starts_at ?? "",
          s.ends_at ?? "",
          s.rooms?.name ?? "",
          s.title,
          speakers,
          primary,
          simulcast,
          primary + simulcast,
          fb?.total ?? 0,
          fb?.green ?? 0,
          fb?.yellow ?? 0,
          fb?.red ?? 0,
          fb?.comments.length ?? 0,
          allComments,
        ];
      });

      const csv = [
        header.map(escapeCsv).join(","),
        ...rows.map((r) => r.map(escapeCsv).join(",")),
      ].join("\n");

      // 8) Send via Resend with CSV attachment
      const date = new Date().toISOString().split("T")[0];
      const filename = `${slug}-session-report-${date}.csv`;
      const from = eventRecord?.domain
        ? `${eventName} <noreply@${eventRecord.domain}>`
        : undefined;

      try {
        await sendEmail({
          from,
          to: recipient,
          subject: `${eventName} session report (${sessions.length} sessions)`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1B1D23;">
              <h2 style="margin: 0 0 16px;">${eventName} session report</h2>
              <p style="margin: 0 0 12px; color: #4a4d57;">
                Attached is a CSV with one row per session, including room, speakers,
                attendance counts (primary + simulcast), and aggregated feedback ratings
                with all comments concatenated.
              </p>
              <p style="margin: 0 0 12px; color: #4a4d57;">
                Open it in Excel, Google Sheets, or Numbers.
              </p>
              <p style="margin: 24px 0 0; font-size: 12px; color: #8a8d97;">
                Sent from the ${eventName} app.
              </p>
            </div>
          `,
          text: `${eventName} session report\n\nAttached is a CSV with one row per session, including room, speakers, attendance counts, and feedback.\n`,
          attachments: [
            { filename, content: Buffer.from(csv, "utf8") },
          ],
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        return NextResponse.json(
          { error: `Failed to send email: ${message}` },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        sent_to: recipient,
        session_count: sessions.length,
      });
    },
  );
}
