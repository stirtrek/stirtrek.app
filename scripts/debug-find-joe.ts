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
  const term = "joe";

  console.log(`\n[A] Profiles where any name/email contains "${term}":`);
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name, display_name")
    .or(
      `email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,display_name.ilike.%${term}%`,
    );
  console.log(`  found: ${profiles?.length ?? 0}`);
  for (const p of profiles ?? []) {
    console.log(
      `  - ${p.id}  email=${p.email}  first=${p.first_name}  last=${p.last_name}  display=${p.display_name}`,
    );
  }

  if (!profiles || profiles.length === 0) return;

  console.log(`\n[B] For each, check event_memberships in event ${eventId}:`);
  const ids = profiles.map((p) => p.id);
  const { data: memberships } = await admin
    .from("event_memberships")
    .select("user_id, role")
    .eq("event_id", eventId)
    .in("user_id", ids);
  const memberSet = new Set((memberships ?? []).map((m) => m.user_id));
  for (const p of profiles) {
    const inEvent = memberSet.has(p.id);
    console.log(
      `  - ${p.email ?? p.display_name ?? p.id}: ${inEvent ? "✓ member" : "✗ NOT in event_memberships"}`,
    );
  }

  console.log("\n[C] What the admin Users API would return for q=joe:");
  const { data: rows, count } = await admin
    .from("event_memberships")
    .select(
      "user_id, role, is_sponsor, sponsor_id, profiles!inner(id, email, first_name, last_name, display_name)",
      { count: "exact" },
    )
    .eq("event_id", eventId)
    .or(
      `email.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,display_name.ilike.%${term}%`,
      { foreignTable: "profiles" },
    )
    .order("created_at", { foreignTable: "profiles", ascending: false })
    .range(0, 49);
  console.log(`  count=${count}, rows=${rows?.length ?? 0}`);
  for (const r of (rows ?? []) as unknown as {
    profiles: { email: string; first_name: string | null; last_name: string | null; display_name: string | null };
  }[]) {
    console.log(
      `  - ${r.profiles.email}  ${r.profiles.first_name} ${r.profiles.last_name}  display=${r.profiles.display_name}`,
    );
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
