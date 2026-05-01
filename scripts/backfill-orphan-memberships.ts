/**
 * Backfill: insert event_memberships rows (role=attendee) for every
 * profile that has zero memberships, scoped to the Stir Trek event.
 *
 * Usage:
 *   npx tsx scripts/backfill-orphan-memberships.ts            # dry-run
 *   npx tsx scripts/backfill-orphan-memberships.ts --execute  # actually insert
 *
 * Idempotent: even if run twice, the unique (event_id, user_id) constraint
 * (or our pre-check) prevents duplicates.
 */

import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const text = readFileSync(`${process.cwd()}/.env.local`, "utf8");
for (const line of text.split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  const k = t.slice(0, eq).trim();
  let v = t.slice(eq + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  )
    v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

const STIRTREK_EVENT_ID = "00000000-0000-0000-0000-000000000001";
const EXECUTE = process.argv.includes("--execute");

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  console.log(`Mode: ${EXECUTE ? "EXECUTE (will insert)" : "DRY-RUN (no writes)"}`);
  console.log(`Target event_id: ${STIRTREK_EVENT_ID}`);
  console.log("");

  // 1. Load distinct user_ids that already have a membership in ANY event.
  const memberSet = new Set<string>();
  let from = 0;
  const chunk = 1000;
  while (true) {
    const { data, error } = await admin
      .from("event_memberships")
      .select("user_id")
      .range(from, from + chunk - 1);
    if (error) throw new Error(`event_memberships: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const m of data) memberSet.add(m.user_id);
    if (data.length < chunk) break;
    from += chunk;
  }

  // 2. Page through all profiles; collect those NOT in memberSet.
  const orphans: { id: string; email: string | null; created_at: string }[] = [];
  from = 0;
  while (true) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + chunk - 1);
    if (error) throw new Error(`profiles: ${error.message}`);
    if (!data || data.length === 0) break;
    for (const p of data) {
      if (!memberSet.has(p.id)) orphans.push(p);
    }
    if (data.length < chunk) break;
    from += chunk;
  }

  console.log(`Orphan profiles (no membership in any event): ${orphans.length}`);
  console.log("");
  console.log("First 5 to be backfilled:");
  for (const p of orphans.slice(0, 5)) {
    console.log(`  ${p.created_at.slice(0, 10)}  ${p.email ?? "(no email)"}  id=${p.id}`);
  }
  console.log(`  …and ${Math.max(0, orphans.length - 5)} more`);
  console.log("");

  if (orphans.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (!EXECUTE) {
    console.log("DRY-RUN complete. Re-run with --execute to actually insert.");
    return;
  }

  // 3. Insert in batches of 100. Use upsert with onConflict to be idempotent
  //    in case a race or partial prior run left some rows already present.
  const rows = orphans.map((p) => ({
    event_id: STIRTREK_EVENT_ID,
    user_id: p.id,
    role: "attendee" as const,
  }));

  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const { error, count } = await admin
      .from("event_memberships")
      .upsert(batch, {
        onConflict: "event_id,user_id",
        ignoreDuplicates: true,
        count: "exact",
      });
    if (error) {
      console.error(`Batch ${i / batchSize}: ERROR — ${error.message}`);
      throw error;
    }
    inserted += count ?? batch.length;
    console.log(
      `Batch ${i / batchSize + 1}/${Math.ceil(rows.length / batchSize)}: ${batch.length} rows`,
    );
  }

  console.log("");
  console.log(`Done. Inserted/upserted ${inserted} rows.`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
