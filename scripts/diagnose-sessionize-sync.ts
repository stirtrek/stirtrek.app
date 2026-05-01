/**
 * Read-only diagnostic: compare Sessionize API response against the DB
 * for every event that has a sessionize_api_id, and report drift.
 *
 * Usage:
 *   npx tsx scripts/diagnose-sessionize-sync.ts
 *
 * Reports for each event:
 *   - Sessions present in Sessionize but missing from DB (sync gap)
 *   - Sessions present in DB but missing from Sessionize (orphans)
 *   - Same diff for speakers and rooms
 *
 * Performs NO writes.
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadDotEnv(path: string) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadDotEnv(`${process.cwd()}/.env.local`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface SessionizeSession {
  id: string;
  title: string;
  status?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  roomId?: number | null;
  speakers?: string[];
  isServiceSession?: boolean;
  isPlenumSession?: boolean;
}

interface SessionizeSpeaker {
  id: string;
  fullName: string;
}

interface SessionizeRoom {
  id: number;
  name: string;
}

interface SessionizeAll {
  sessions: SessionizeSession[];
  speakers: SessionizeSpeaker[];
  rooms: SessionizeRoom[];
}

async function fetchSessionize(apiId: string): Promise<SessionizeAll> {
  const res = await fetch(`https://sessionize.com/api/v2/${apiId}/view/All`);
  if (!res.ok) {
    throw new Error(`Sessionize ${res.status} ${res.statusText}`);
  }
  return res.json();
}

function diffSets(
  apiIds: Set<string>,
  dbIds: Set<string>,
): { onlyInApi: string[]; onlyInDb: string[] } {
  const onlyInApi = [...apiIds].filter((id) => !dbIds.has(id)).sort();
  const onlyInDb = [...dbIds].filter((id) => !apiIds.has(id)).sort();
  return { onlyInApi, onlyInDb };
}

async function diagnoseEvent(event: {
  id: string;
  slug: string;
  name: string;
  sessionize_api_id: string;
}) {
  console.log("");
  console.log("=".repeat(72));
  console.log(`Event: ${event.name} (slug=${event.slug})`);
  console.log(`  event_id=${event.id}  sessionize_api_id=${event.sessionize_api_id}`);
  console.log("=".repeat(72));

  let api: SessionizeAll;
  try {
    api = await fetchSessionize(event.sessionize_api_id);
  } catch (e) {
    console.log(`  Sessionize fetch FAILED: ${(e as Error).message}`);
    return;
  }

  const apiSessions = api.sessions ?? [];
  const apiSpeakers = api.speakers ?? [];
  const apiRooms = api.rooms ?? [];

  console.log(
    `  Sessionize counts: ${apiSessions.length} sessions, ${apiSpeakers.length} speakers, ${apiRooms.length} rooms`,
  );

  // Status breakdown — useful for bug #1
  const statusBreakdown = new Map<string, number>();
  for (const s of apiSessions) {
    const k = s.status ?? "(null)";
    statusBreakdown.set(k, (statusBreakdown.get(k) ?? 0) + 1);
  }
  console.log(
    `  Sessionize session status breakdown: ${[...statusBreakdown.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join(", ")}`,
  );

  // Sessions with no startsAt / no roomId — possible drafts
  const noStart = apiSessions.filter((s) => !s.startsAt).length;
  const noRoom = apiSessions.filter(
    (s) => s.roomId === null || s.roomId === undefined,
  ).length;
  console.log(
    `  Sessionize sessions missing startsAt: ${noStart}; missing roomId: ${noRoom}`,
  );

  const { data: dbSessions, error: dbSessErr } = await supabase
    .from("sessions")
    .select("id, title, starts_at, room_id, status")
    .eq("event_id", event.id);
  if (dbSessErr) {
    console.log(`  DB sessions query FAILED: ${dbSessErr.message}`);
    return;
  }
  const { data: dbSpeakers, error: dbSpkErr } = await supabase
    .from("speakers")
    .select("id, full_name")
    .eq("event_id", event.id);
  if (dbSpkErr) {
    console.log(`  DB speakers query FAILED: ${dbSpkErr.message}`);
    return;
  }
  const { data: dbRooms, error: dbRoomErr } = await supabase
    .from("rooms")
    .select("id, name")
    .eq("event_id", event.id);
  if (dbRoomErr) {
    console.log(`  DB rooms query FAILED: ${dbRoomErr.message}`);
    return;
  }

  console.log(
    `  DB counts:        ${dbSessions?.length ?? 0} sessions, ${dbSpeakers?.length ?? 0} speakers, ${dbRooms?.length ?? 0} rooms`,
  );

  // --- Sessions diff ---
  const apiSessIds = new Set(apiSessions.map((s) => String(s.id)));
  const dbSessIds = new Set((dbSessions ?? []).map((s) => String(s.id)));
  const sessDiff = diffSets(apiSessIds, dbSessIds);

  const apiSessById = new Map(apiSessions.map((s) => [String(s.id), s]));
  const dbSessById = new Map(
    (dbSessions ?? []).map((s) => [String(s.id), s as { id: string; title: string; starts_at: string | null; room_id: number | null; status: string | null }]),
  );

  console.log("");
  console.log(
    `  SESSIONS in Sessionize but NOT in DB (sync misses): ${sessDiff.onlyInApi.length}`,
  );
  for (const id of sessDiff.onlyInApi) {
    const s = apiSessById.get(id)!;
    console.log(
      `    - [${id}] "${s.title}"  status=${s.status ?? "null"}  startsAt=${s.startsAt ?? "null"}  roomId=${s.roomId ?? "null"}`,
    );
  }

  console.log("");
  console.log(
    `  SESSIONS in DB but NOT in Sessionize (orphans): ${sessDiff.onlyInDb.length}`,
  );
  for (const id of sessDiff.onlyInDb) {
    const s = dbSessById.get(id)!;
    console.log(
      `    - [${id}] "${s.title}"  status=${s.status ?? "null"}  starts_at=${s.starts_at ?? "null"}  room_id=${s.room_id ?? "null"}`,
    );
  }

  // --- Speakers diff ---
  const apiSpkIds = new Set(apiSpeakers.map((s) => String(s.id)));
  const dbSpkIds = new Set((dbSpeakers ?? []).map((s) => String(s.id)));
  const spkDiff = diffSets(apiSpkIds, dbSpkIds);

  const apiSpkById = new Map(apiSpeakers.map((s) => [String(s.id), s]));
  const dbSpkById = new Map(
    (dbSpeakers ?? []).map((s) => [String(s.id), s as { id: string; full_name: string }]),
  );

  console.log("");
  console.log(
    `  SPEAKERS in Sessionize but NOT in DB: ${spkDiff.onlyInApi.length}`,
  );
  for (const id of spkDiff.onlyInApi) {
    console.log(`    - [${id}] ${apiSpkById.get(id)!.fullName}`);
  }

  console.log("");
  console.log(
    `  SPEAKERS in DB but NOT in Sessionize (orphans): ${spkDiff.onlyInDb.length}`,
  );
  for (const id of spkDiff.onlyInDb) {
    console.log(`    - [${id}] ${dbSpkById.get(id)!.full_name}`);
  }

  // --- Rooms diff ---
  const apiRoomIds = new Set(apiRooms.map((r) => String(r.id)));
  const dbRoomIds = new Set((dbRooms ?? []).map((r) => String(r.id)));
  const roomDiff = diffSets(apiRoomIds, dbRoomIds);

  const apiRoomById = new Map(apiRooms.map((r) => [String(r.id), r]));
  const dbRoomById = new Map(
    (dbRooms ?? []).map((r) => [String(r.id), r as { id: number; name: string }]),
  );

  console.log("");
  console.log(
    `  ROOMS in Sessionize but NOT in DB: ${roomDiff.onlyInApi.length}`,
  );
  for (const id of roomDiff.onlyInApi) {
    console.log(`    - [${id}] ${apiRoomById.get(id)!.name}`);
  }

  console.log("");
  console.log(
    `  ROOMS in DB but NOT in Sessionize (orphans): ${roomDiff.onlyInDb.length}`,
  );
  for (const id of roomDiff.onlyInDb) {
    console.log(`    - [${id}] ${dbRoomById.get(id)!.name}`);
  }
}

async function main() {
  const { data: events, error } = await supabase
    .from("events")
    .select("id, slug, name, sessionize_api_id")
    .not("sessionize_api_id", "is", null)
    .order("slug");

  if (error) {
    console.error("Failed to load events:", error.message);
    process.exit(1);
  }
  if (!events || events.length === 0) {
    console.log("No events with a sessionize_api_id configured.");
    return;
  }

  console.log(`Found ${events.length} event(s) with Sessionize configured.`);
  for (const e of events) {
    await diagnoseEvent(
      e as {
        id: string;
        slug: string;
        name: string;
        sessionize_api_id: string;
      },
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
