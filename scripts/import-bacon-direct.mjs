/**
 * Direct Supabase import of BACon 2026 speakers and sessions.
 * Uses the admin/secret key — no browser auth needed.
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const EVENT_SLUG = "bacon";

async function main() {
  // 1. Resolve event ID
  const { data: event, error: evErr } = await supabase
    .from("events")
    .select("id")
    .eq("slug", EVENT_SLUG)
    .single();

  if (evErr || !event) {
    console.error("Could not find event with slug 'bacon':", evErr?.message);
    process.exit(1);
  }

  const eventId = event.id;
  console.log(`Found event: ${eventId}\n`);

  // 2. Load speaker data
  const data = JSON.parse(
    readFileSync(join(__dirname, "..", "data", "bacon-2026-speakers.json"), "utf-8")
  );

  // 3. Insert speakers
  console.log(`Creating ${data.speakers.length} speakers...`);
  const speakerIdMap = new Map(); // full_name -> id

  for (const s of data.speakers) {
    const speakerId = randomUUID();
    const { data: created, error } = await supabase
      .from("speakers")
      .insert({
        id: speakerId,
        event_id: eventId,
        first_name: s.first_name,
        last_name: s.last_name,
        full_name: s.full_name,
        bio: s.bio,
        tag_line: s.tag_line,
        profile_picture: s.profile_picture,
        is_top_speaker: false,
        links: [],
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  FAIL: ${s.full_name} — ${error.message}`);
      continue;
    }

    speakerIdMap.set(s.full_name, created.id);
    console.log(`  OK: ${s.full_name} → ${created.id}`);
  }

  // 4. Build sessions from speaker data, grouping co-presenters
  const sessionMap = new Map(); // title -> { title, speakerNames[] }

  for (const s of data.speakers) {
    const titles = s.session_titles || [s.session_title];
    for (const title of titles) {
      const existing = sessionMap.get(title);
      if (existing) {
        existing.speakerNames.push(s.full_name);
      } else {
        sessionMap.set(title, { title, speakerNames: [s.full_name] });
      }
    }
  }

  // 5. Insert sessions and link speakers
  console.log(`\nCreating ${sessionMap.size} sessions...`);

  for (const [, session] of sessionMap) {
    const sessionId = `bacon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: created, error } = await supabase
      .from("sessions")
      .insert({
        id: sessionId,
        event_id: eventId,
        title: session.title,
        description: null,
        starts_at: null,
        ends_at: null,
        room_id: null,
        is_service_session: false,
        is_plenum_session: false,
        status: "Accepted",
      })
      .select("id")
      .single();

    if (error) {
      console.error(`  FAIL: "${session.title}" — ${error.message}`);
      continue;
    }

    // Link speakers to session
    const speakerLinks = session.speakerNames
      .map((name) => speakerIdMap.get(name))
      .filter(Boolean)
      .map((speakerId) => ({
        session_id: created.id,
        speaker_id: speakerId,
        event_id: eventId,
      }));

    if (speakerLinks.length > 0) {
      const { error: linkErr } = await supabase
        .from("session_speakers")
        .insert(speakerLinks);

      if (linkErr) {
        console.error(`  WARN: Could not link speakers for "${session.title}" — ${linkErr.message}`);
      }
    }

    console.log(`  OK: "${session.title}" [${session.speakerNames.join(", ")}]`);
  }

  console.log(`\nDone!`);
  console.log(`  Speakers: ${speakerIdMap.size}/${data.speakers.length}`);
  console.log(`  Sessions: ${sessionMap.size}`);
}

main().catch(console.error);
