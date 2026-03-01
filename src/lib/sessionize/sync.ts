import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSessionizeData } from "./client";
import type { SessionizeResponse } from "./types";
import { getTelemetryService } from "@/lib/telemetry/service";

interface SyncResult {
  rooms: number;
  categories: number;
  speakers: number;
  sessions: number;
  error?: string;
}

export async function syncSessionizeData(
  triggeredBy?: string,
): Promise<SyncResult> {
  const telemetry = getTelemetryService();
  return telemetry.trackSessionizeSync(async () => {
    const supabase = createAdminClient();

    // Create sync log entry
    const { data: syncLog } = await supabase
      .from("sessionize_sync_log")
      .insert({
        status: "in_progress",
        triggered_by: triggeredBy || null,
      })
      .select("id")
      .single();

    const syncId = syncLog?.id;

    try {
      const data = await fetchSessionizeData();
      const result = await upsertData(supabase, data);

      // Update sync log
      if (syncId) {
        await supabase
          .from("sessionize_sync_log")
          .update({
            status: "completed",
            rooms_synced: result.rooms,
            speakers_synced: result.speakers,
            sessions_synced: result.sessions,
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncId);
      }

      telemetry.logInfo("Sessionize sync completed", {
        rooms: result.rooms,
        speakers: result.speakers,
        sessions: result.sessions,
        triggeredBy: triggeredBy || "cron",
      });

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error during sync";

      if (syncId) {
        await supabase
          .from("sessionize_sync_log")
          .update({
            status: "failed",
            error_message: message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncId);
      }

      telemetry.logError("Sessionize sync failed", { error: message });

      return {
        rooms: 0,
        categories: 0,
        speakers: 0,
        sessions: 0,
        error: message,
      };
    }
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertData(
  supabase: any,
  data: SessionizeResponse,
): Promise<SyncResult> {
  // 1. Upsert rooms
  if (data.rooms.length > 0) {
    const rooms = data.rooms.map((r) => ({
      id: r.id,
      name: r.name,
      sort_order: r.sort,
    }));

    const { error } = await supabase
      .from("rooms")
      .upsert(rooms, { onConflict: "id" });
    if (error) throw new Error(`Failed to upsert rooms: ${error.message}`);
  }

  // 2. Upsert categories and category items
  let categoryItemCount = 0;
  for (const cat of data.categories) {
    const { error: catError } = await supabase
      .from("categories")
      .upsert(
        {
          id: cat.id,
          title: cat.title,
          category_type: cat.type,
          sort_order: cat.sort,
        },
        { onConflict: "id" },
      );
    if (catError)
      throw new Error(`Failed to upsert category: ${catError.message}`);

    if (cat.items.length > 0) {
      const items = cat.items.map((item) => ({
        id: item.id,
        category_id: cat.id,
        name: item.name,
        sort_order: item.sort,
      }));

      const { error: itemError } = await supabase
        .from("category_items")
        .upsert(items, { onConflict: "id" });
      if (itemError)
        throw new Error(
          `Failed to upsert category items: ${itemError.message}`,
        );

      categoryItemCount += items.length;
    }
  }

  // 3. Upsert speakers
  if (data.speakers.length > 0) {
    const speakers = data.speakers.map((s) => ({
      id: s.id,
      first_name: s.firstName,
      last_name: s.lastName,
      full_name: s.fullName,
      bio: s.bio,
      tag_line: s.tagLine,
      profile_picture: s.profilePicture,
      is_top_speaker: s.isTopSpeaker,
      links: s.links,
      sessionize_data: s,
    }));

    const { error } = await supabase
      .from("speakers")
      .upsert(speakers, { onConflict: "id" });
    if (error)
      throw new Error(`Failed to upsert speakers: ${error.message}`);
  }

  // 4. Upsert sessions
  if (data.sessions.length > 0) {
    const sessions = data.sessions.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      starts_at: s.startsAt,
      ends_at: s.endsAt,
      room_id: s.roomId,
      is_service_session: s.isServiceSession,
      is_plenum_session: s.isPlenumSession,
      live_url: s.liveUrl,
      recording_url: s.recordingUrl,
      status: s.status,
      sessionize_data: s,
    }));

    const { error } = await supabase
      .from("sessions")
      .upsert(sessions, { onConflict: "id" });
    if (error)
      throw new Error(`Failed to upsert sessions: ${error.message}`);
  }

  // 5. Sync session_speakers junction table
  // Build from session.speakers (array of speaker UUIDs)
  const sessionSpeakers: { session_id: string; speaker_id: string }[] = [];
  for (const session of data.sessions) {
    for (const speakerId of session.speakers) {
      sessionSpeakers.push({
        session_id: session.id,
        speaker_id: speakerId,
      });
    }
  }

  // Clear and re-insert (simplest approach for junction tables)
  await supabase.from("session_speakers").delete().neq("session_id", "");
  if (sessionSpeakers.length > 0) {
    const { error } = await supabase
      .from("session_speakers")
      .insert(sessionSpeakers);
    if (error)
      throw new Error(`Failed to sync session_speakers: ${error.message}`);
  }

  // 6. Sync session_categories junction table
  const sessionCategories: {
    session_id: string;
    category_item_id: number;
  }[] = [];
  for (const session of data.sessions) {
    for (const catItemId of session.categoryItems) {
      sessionCategories.push({
        session_id: session.id,
        category_item_id: catItemId,
      });
    }
  }

  await supabase.from("session_categories").delete().neq("session_id", "");
  if (sessionCategories.length > 0) {
    const { error } = await supabase
      .from("session_categories")
      .insert(sessionCategories);
    if (error)
      throw new Error(
        `Failed to sync session_categories: ${error.message}`,
      );
  }

  return {
    rooms: data.rooms.length,
    categories: data.categories.length + categoryItemCount,
    speakers: data.speakers.length,
    sessions: data.sessions.length,
  };
}
