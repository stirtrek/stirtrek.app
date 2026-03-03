/**
 * Bulk import BACon 2026 speakers and sessions from scraped JSON.
 *
 * Usage:
 *   npx tsx scripts/import-bacon-speakers.ts <event-slug> <admin-cookie>
 *
 * Example:
 *   npx tsx scripts/import-bacon-speakers.ts bacon "sb-access-token=...; sb-refresh-token=..."
 *
 * To get your admin cookie:
 *   1. Log in to the app as an admin for the Bacon event
 *   2. Open DevTools → Application → Cookies
 *   3. Copy the full cookie string (or just the sb-* tokens)
 *
 * The script will:
 *   1. Create all speakers via POST /api/admin/speakers
 *   2. Create all sessions via POST /api/admin/sessions, linking co-speakers
 */

import { readFileSync } from "fs";
import { join } from "path";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

interface SpeakerEntry {
  full_name: string;
  first_name: string;
  last_name: string;
  tag_line: string;
  bio: string;
  profile_picture: string;
  session_title: string;
  session_titles?: string[];
}

interface ImportData {
  speakers: SpeakerEntry[];
}

async function main() {
  const [, , eventSlug, cookie] = process.argv;

  if (!eventSlug || !cookie) {
    console.error("Usage: npx tsx scripts/import-bacon-speakers.ts <event-slug> <cookie>");
    console.error('  cookie: your browser cookie string (sb-* tokens)');
    process.exit(1);
  }

  const dataPath = join(__dirname, "..", "data", "bacon-2026-speakers.json");
  const data: ImportData = JSON.parse(readFileSync(dataPath, "utf-8"));

  const headers = {
    "Content-Type": "application/json",
    Cookie: cookie,
  };

  // Step 1: Create all speakers
  console.log(`\nCreating ${data.speakers.length} speakers...\n`);
  const speakerIdMap = new Map<string, string>(); // full_name -> id

  for (const s of data.speakers) {
    const res = await fetch(`${BASE_URL}/${eventSlug}/api/admin/speakers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        first_name: s.first_name,
        last_name: s.last_name,
        bio: s.bio,
        tag_line: s.tag_line,
        profile_picture: s.profile_picture,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`  FAILED: ${s.full_name} — ${res.status} ${JSON.stringify(err)}`);
      continue;
    }

    const created = await res.json();
    speakerIdMap.set(s.full_name, created.id);
    console.log(`  OK: ${s.full_name} → ${created.id}`);
  }

  // Step 2: Group speakers by session title to handle co-presentations
  const sessionMap = new Map<string, { title: string; speakerNames: string[] }>();

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

  // Step 3: Create sessions
  console.log(`\nCreating ${sessionMap.size} sessions...\n`);

  for (const [, session] of sessionMap) {
    const speakerIds = session.speakerNames
      .map((name) => speakerIdMap.get(name))
      .filter(Boolean) as string[];

    const res = await fetch(`${BASE_URL}/${eventSlug}/api/admin/sessions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: session.title,
        description: null,
        starts_at: null,
        ends_at: null,
        room_id: null,
        speaker_ids: speakerIds,
        is_service_session: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`  FAILED: "${session.title}" — ${res.status} ${JSON.stringify(err)}`);
      continue;
    }

    console.log(`  OK: "${session.title}" [${session.speakerNames.join(", ")}]`);
  }

  console.log("\nDone!");
  console.log(`  Speakers created: ${speakerIdMap.size}/${data.speakers.length}`);
  console.log(`  Sessions created: ${sessionMap.size}`);
  console.log("\nNote: Times, rooms, and descriptions can be set in the admin UI.");
}

main().catch(console.error);
