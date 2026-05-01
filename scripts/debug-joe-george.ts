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

  const joeId = "4f740cae-2ad5-42f4-b74d-2631cfa8daa9";

  console.log("[A] Joe George's profile:");
  const { data: profile } = await admin
    .from("profiles")
    .select("*")
    .eq("id", joeId)
    .single();
  console.log(JSON.stringify(profile, null, 2));

  console.log("\n[B] All event_memberships rows for Joe (any event):");
  const { data: memberships } = await admin
    .from("event_memberships")
    .select("event_id, role, joined_at, is_sponsor")
    .eq("user_id", joeId);
  console.log(`  count: ${memberships?.length ?? 0}`);
  for (const m of memberships ?? []) {
    console.log(`  - event_id=${m.event_id}  role=${m.role}  joined=${m.joined_at}`);
  }

  console.log("\n[C] All events in the system (for context):");
  const { data: events } = await admin
    .from("events")
    .select("id, slug, name, is_active")
    .order("name");
  for (const e of events ?? []) {
    console.log(`  - ${e.slug}  id=${e.id}  active=${e.is_active}  name="${e.name}"`);
  }

  console.log("\n[D] Has Joe ever placed a Stripe order?");
  const { data: orders } = await admin
    .from("stripe_orders")
    .select("id, status, customer_email, created_at")
    .or(`customer_email.eq.${profile?.email},user_id.eq.${joeId}`);
  console.log(`  count: ${orders?.length ?? 0}`);
  for (const o of orders ?? []) {
    console.log(
      `  - id=${o.id}  status=${o.status}  email=${o.customer_email}  created=${o.created_at}`,
    );
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
