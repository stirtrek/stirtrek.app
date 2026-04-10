import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTelemetryService } from "@/lib/telemetry/service";
import { getEventId, resolveEffectiveUser } from "@/lib/events/api-helpers";
import { sendEmail } from "@/lib/email";

function escapeCsvField(field: string): string {
  if (field.includes(",") || field.includes('"') || field.includes("\n")) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

export async function POST(request: NextRequest) {
  const telemetry = getTelemetryService();
  return telemetry.trackAPIRoute("/api/leads/export", "POST", async () => {
    const eventId = getEventId(request);
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "Your account has no email address on file" },
        { status: 400 },
      );
    }

    const { effectiveUserId } = await resolveEffectiveUser(request, user.id);

    const admin = createAdminClient();
    const { data: membership } = await admin
      .from("event_memberships")
      .select("is_sponsor")
      .eq("event_id", eventId)
      .eq("user_id", effectiveUserId)
      .single();

    if (!membership?.is_sponsor) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: leads, error } = await admin
      .from("leads")
      .select("*")
      .eq("event_id", eventId)
      .eq("sponsor_profile_id", effectiveUserId)
      .order("scanned_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json(
        { error: "You have no leads to export yet" },
        { status: 400 },
      );
    }

    const header = "Email,First Name,Last Name,Scanned At,Notes";
    const rows = leads.map((lead) =>
      [
        escapeCsvField(lead.attendee_email),
        escapeCsvField(lead.attendee_first_name || ""),
        escapeCsvField(lead.attendee_last_name || ""),
        escapeCsvField(new Date(lead.scanned_at).toISOString()),
        escapeCsvField(lead.notes || ""),
      ].join(","),
    );

    const csv = [header, ...rows].join("\n");
    const date = new Date().toISOString().split("T")[0];

    const { data: eventRecord } = await admin
      .from("events")
      .select("slug, name, short_name, domain")
      .eq("id", eventId)
      .single();
    const slug = eventRecord?.slug ?? "event";
    const eventName = eventRecord?.name ?? eventRecord?.short_name ?? "the event";
    const filename = `${slug}-leads-${date}.csv`;
    const leadCount = leads.length;

    // Build the From address from the event's custom domain when set,
    // so emails come from the event's verified domain (e.g. stirtrek.app)
    // rather than a shared platform address.
    const from = eventRecord?.domain
      ? `${eventName} <noreply@${eventRecord.domain}>`
      : undefined;

    try {
      await sendEmail({
        from,
        to: user.email,
        subject: `Your ${eventName} leads (${leadCount})`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1B1D23;">
            <h2 style="margin: 0 0 16px;">Your leads from ${eventName}</h2>
            <p style="margin: 0 0 12px; color: #4a4d57;">
              Attached is a CSV export of the ${leadCount} lead${leadCount === 1 ? "" : "s"} you've scanned at ${eventName}.
            </p>
            <p style="margin: 0 0 12px; color: #4a4d57;">
              Open it in Excel, Google Sheets, or your CRM of choice.
            </p>
            <p style="margin: 24px 0 0; font-size: 12px; color: #8a8d97;">
              Sent from the ${eventName} app.
            </p>
          </div>
        `,
        text: `Your leads from ${eventName}\n\nAttached is a CSV export of the ${leadCount} lead${leadCount === 1 ? "" : "s"} you've scanned at ${eventName}.\n\nOpen it in Excel, Google Sheets, or your CRM of choice.`,
        attachments: [
          {
            filename,
            content: Buffer.from(csv, "utf8"),
          },
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
      sent_to: user.email,
      lead_count: leadCount,
    });
  });
}
