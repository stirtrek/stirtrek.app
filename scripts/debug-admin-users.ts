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

async function main() {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const eventId = "00000000-0000-0000-0000-000000000001";

  console.log("\n[1] event_memberships query:");
  const { data: memberships, error: e1 } = await admin
    .from("event_memberships")
    .select("user_id, role, is_sponsor, sponsor_id")
    .eq("event_id", eventId);
  console.log("  error:", e1);
  console.log("  count:", memberships?.length);

  if (!memberships || memberships.length === 0) return;
  const memberIds = memberships.map((m) => m.user_id);

  console.log("\n[2] speakers query:");
  const { data: speakers, error: e2 } = await admin
    .from("speakers")
    .select("user_id")
    .eq("event_id", eventId)
    .not("user_id", "is", null);
  console.log("  error:", e2);
  console.log("  count:", speakers?.length);

  console.log("\n[3] profiles query (the suspect):");
  const {
    data: profiles,
    error: e3,
    count,
  } = await admin
    .from("profiles")
    .select(
      "id, email, display_name, first_name, last_name, is_super_admin, created_at",
      { count: "exact" },
    )
    .in("id", memberIds)
    .order("created_at", { ascending: false })
    .range(0, 49);
  console.log("  error:", e3);
  console.log("  count:", count, "rows returned:", profiles?.length);

  console.log("\n[4] proposed fix — embed profiles in event_memberships:");
  const {
    data: joined,
    error: e4,
    count: count2,
  } = await admin
    .from("event_memberships")
    .select(
      "user_id, role, is_sponsor, sponsor_id, profiles!inner(id, email, display_name, first_name, last_name, is_super_admin, created_at)",
      { count: "exact" },
    )
    .eq("event_id", eventId)
    .order("created_at", { foreignTable: "profiles", ascending: false })
    .range(0, 49);
  console.log("  error:", e4);
  console.log("  count:", count2, "rows returned:", joined?.length);
  if (joined && joined[0]) {
    console.log("  first row sample:", JSON.stringify(joined[0], null, 2));
  }

  console.log("\n[5] proposed fix WITH search filter on embedded profile:");
  const { data: searched, error: e5 } = await admin
    .from("event_memberships")
    .select(
      "user_id, role, is_sponsor, sponsor_id, profiles!inner(id, email, display_name, first_name, last_name, is_super_admin, created_at)",
      { count: "exact" },
    )
    .eq("event_id", eventId)
    .or(
      "email.ilike.%jeff%,first_name.ilike.%jeff%,last_name.ilike.%jeff%,display_name.ilike.%jeff%",
      { foreignTable: "profiles" },
    )
    .order("created_at", { foreignTable: "profiles", ascending: false })
    .range(0, 49);
  console.log("  error:", e5);
  console.log("  rows returned:", searched?.length);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
