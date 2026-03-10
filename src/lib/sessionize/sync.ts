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

/**
 * Sync Sessionize data for a specific event.
 * Reads the sessionize_api_id from the event record.
 */
export async function syncSessionizeData(
  triggeredBy: string | undefined,
  eventId: string,
): Promise<SyncResult> {
  const telemetry = getTelemetryService();
  return telemetry.trackSessionizeSync(async () => {
    const supabase = createAdminClient();

    // Resolve the Sessionize API ID
    const { data: event } = await supabase
      .from("events")
      .select("sessionize_api_id")
      .eq("id", eventId)
      .single();

    if (!event?.sessionize_api_id) {
      return {
        rooms: 0,
        categories: 0,
        speakers: 0,
        sessions: 0,
        error: "No Sessionize API ID configured for this event",
      };
    }

    // Create sync log entry
    const { data: syncLog } = await supabase
      .from("sessionize_sync_log")
      .insert({
        status: "in_progress",
        triggered_by: triggeredBy || null,
        event_id: eventId,
      })
      .select("id")
      .single();

    const syncId = syncLog?.id;

    try {
      const data = await fetchSessionizeData(event.sessionize_api_id);
      const result = await upsertData(supabase, data, eventId);

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
        eventId: eventId,
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
  eventId: string,
): Promise<SyncResult> {
  // 1. Upsert rooms
  if (data.rooms.length > 0) {
    const rooms = data.rooms.map((r) => ({
      id: r.id,
      event_id: eventId,
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
          event_id: eventId,
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
        event_id: eventId,
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

  // 3. Upsert speakers (preserve user_id links across syncs)
  if (data.speakers.length > 0) {
    // Save existing user_id mappings before upsert overwrites them
    const { data: existingLinks } = await supabase
      .from("speakers")
      .select("id, user_id")
      .eq("event_id", eventId)
      .not("user_id", "is", null);

    const speakers = data.speakers.map((s) => ({
      id: s.id,
      event_id: eventId,
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

    // Restore user_id links that may have been cleared by the upsert
    if (existingLinks && existingLinks.length > 0) {
      for (const link of existingLinks) {
        await supabase
          .from("speakers")
          .update({ user_id: link.user_id })
          .eq("id", link.id)
          .eq("event_id", eventId);
      }
    }
  }

  // 4. Upsert sessions
  if (data.sessions.length > 0) {
    const sessions = data.sessions.map((s) => ({
      id: s.id,
      event_id: eventId,
      title: s.title,
      description: s.description,
      starts_at: s.startsAt ?? null,
      ends_at: s.endsAt ?? null,
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

  // 5. Sync session_speakers junction table (scoped to this event)
  // Uses upsert-then-cleanup to prevent data loss on partial failure
  const sessionSpeakers: {
    session_id: string;
    speaker_id: string;
    event_id: string;
  }[] = [];
  for (const session of data.sessions) {
    for (const speakerId of session.speakers) {
      sessionSpeakers.push({
        session_id: session.id,
        speaker_id: speakerId,
        event_id: eventId,
      });
    }
  }

  // Upsert all desired rows first (safe — adds/updates without deleting)
  if (sessionSpeakers.length > 0) {
    const { error } = await supabase
      .from("session_speakers")
      .upsert(sessionSpeakers, { onConflict: "session_id,speaker_id" });
    if (error)
      throw new Error(`Failed to upsert session_speakers: ${error.message}`);
  }

  // Remove stale rows: delete rows for this event that aren't in the new set
  const validSpeakerPairs = sessionSpeakers.map(
    (ss) => `${ss.session_id}|${ss.speaker_id}`,
  );
  const { data: existingSpeakerRows } = await supabase
    .from("session_speakers")
    .select("session_id, speaker_id")
    .eq("event_id", eventId);
  if (existingSpeakerRows) {
    const staleSpeakerRows = existingSpeakerRows.filter(
      (row: { session_id: string; speaker_id: string }) =>
        !validSpeakerPairs.includes(`${row.session_id}|${row.speaker_id}`),
    );
    for (const row of staleSpeakerRows) {
      await supabase
        .from("session_speakers")
        .delete()
        .eq("session_id", row.session_id)
        .eq("speaker_id", row.speaker_id);
    }
  }

  // 6. Sync session_categories junction table (scoped to this event)
  // Uses upsert-then-cleanup to prevent data loss on partial failure
  const sessionCategories: {
    session_id: string;
    category_item_id: number;
    event_id: string;
  }[] = [];
  for (const session of data.sessions) {
    for (const catItemId of session.categoryItems) {
      sessionCategories.push({
        session_id: session.id,
        category_item_id: catItemId,
        event_id: eventId,
      });
    }
  }

  // Upsert all desired rows first (safe — adds/updates without deleting)
  if (sessionCategories.length > 0) {
    const { error } = await supabase
      .from("session_categories")
      .upsert(sessionCategories, {
        onConflict: "session_id,category_item_id",
      });
    if (error)
      throw new Error(
        `Failed to upsert session_categories: ${error.message}`,
      );
  }

  // Remove stale rows: delete rows for this event that aren't in the new set
  const validCategoryPairs = sessionCategories.map(
    (sc) => `${sc.session_id}|${sc.category_item_id}`,
  );
  const { data: existingCategoryRows } = await supabase
    .from("session_categories")
    .select("session_id, category_item_id")
    .eq("event_id", eventId);
  if (existingCategoryRows) {
    const staleCategoryRows = existingCategoryRows.filter(
      (row: { session_id: string; category_item_id: number }) =>
        !validCategoryPairs.includes(
          `${row.session_id}|${row.category_item_id}`,
        ),
    );
    for (const row of staleCategoryRows) {
      await supabase
        .from("session_categories")
        .delete()
        .eq("session_id", row.session_id)
        .eq("category_item_id", row.category_item_id);
    }
  }

  return {
    rooms: data.rooms.length,
    categories: data.categories.length + categoryItemCount,
    speakers: data.speakers.length,
    sessions: data.sessions.length,
  };
}
