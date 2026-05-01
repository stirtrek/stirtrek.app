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

  const { count: profileCount } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true });

  // Distinct user_ids with at least one membership
  const memberSet = new Set<string>();
  let from = 0;
  const chunk = 1000;
  while (true) {
    const { data, error } = await admin
      .from("event_memberships")
      .select("user_id")
      .range(from, from + chunk - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const m of data) memberSet.add(m.user_id);
    if (data.length < chunk) break;
    from += chunk;
  }

  // Page through all profiles to find those NOT in memberSet
  const orphans: {
    id: string;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    created_at: string;
  }[] = [];
  from = 0;
  while (true) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email, first_name, last_name, display_name, created_at")
      .order("created_at", { ascending: false })
      .range(from, from + chunk - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    for (const p of data) {
      if (!memberSet.has(p.id)) orphans.push(p);
    }
    if (data.length < chunk) break;
    from += chunk;
  }

  console.log(`Total profiles:          ${profileCount}`);
  console.log(`Profiles with ≥1 event:  ${memberSet.size}`);
  console.log(`Profiles in NO event:    ${orphans.length}`);
  console.log("");
  console.log("Most-recent orphan profiles:");
  for (const p of orphans.slice(0, 25)) {
    const name =
      [p.first_name, p.last_name].filter(Boolean).join(" ") ||
      p.display_name ||
      "(no name)";
    const emailStr = p.email ?? "(no email)";
    console.log(
      `  ${p.created_at.slice(0, 10)}  ${emailStr}  —  ${name}`,
    );
  }
  if (orphans.length > 25) {
    console.log(`  …and ${orphans.length - 25} more`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
