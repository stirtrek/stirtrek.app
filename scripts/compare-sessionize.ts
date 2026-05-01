/**
 * Read-only: produce a markdown document comparing every session in
 * Sessionize against every session in the DB for the configured event.
 *
 * Usage:
 *   npx tsx scripts/compare-sessionize.ts
 *
 * Output:
 *   ./sessionize-comparison.md
 */

import { readFileSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

function loadDotEnv(path: string) {
  const text = readFileSync(path, "utf8");
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
    ) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

loadDotEnv(`${process.cwd()}/.env.local`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SECRET_KEY!;
const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface ApiSession {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  roomId?: number | null;
  room?: string | null;
  speakers?: { id: string; name: string }[] | string[];
  isServiceSession?: boolean;
  isPlenumSession?: boolean;
}

interface DbSession {
  id: string;
  title: string | null;
  starts_at: string | null;
  ends_at: string | null;
  room_id: number | null;
  status: string | null;
  is_service_session: boolean | null;
  is_plenum_session: boolean | null;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "✓" : "—";
  return String(v);
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  // Keep it compact: 2026-05-01 13:00
  return iso.replace("T", " ").replace(/:\d{2}(?:\.\d+)?Z?$/, "");
}

function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}

async function main() {
  const { data: events, error: evErr } = await supabase
    .from("events")
    .select("id, slug, name, sessionize_api_id")
    .not("sessionize_api_id", "is", null)
    .order("slug");

  if (evErr) throw new Error(evErr.message);
  if (!events || events.length === 0) {
    console.log("No events with Sessionize configured.");
    return;
  }

  const out: string[] = [];
  out.push("# Sessionize ↔ App Sessions Comparison");
  out.push("");
  out.push(`Generated: ${new Date().toISOString()}`);
  out.push("");

  for (const event of events as Array<{
    id: string;
    slug: string;
    name: string;
    sessionize_api_id: string;
  }>) {
    out.push("---");
    out.push("");
    out.push(`## Event: ${event.name}`);
    out.push("");
    out.push(`- **slug:** \`${event.slug}\``);
    out.push(`- **event_id:** \`${event.id}\``);
    out.push(`- **sessionize_api_id:** \`${event.sessionize_api_id}\``);
    out.push(
      `- **Sessionize URL:** https://sessionize.com/api/v2/${event.sessionize_api_id}/view/All`,
    );
    out.push("");

    let api: { sessions: ApiSession[]; rooms: { id: number; name: string }[] };
    try {
      const res = await fetch(
        `https://sessionize.com/api/v2/${event.sessionize_api_id}/view/All`,
      );
      if (!res.ok) {
        out.push(`> Sessionize fetch failed: ${res.status} ${res.statusText}`);
        out.push("");
        continue;
      }
      api = await res.json();
    } catch (e) {
      out.push(`> Sessionize fetch failed: ${(e as Error).message}`);
      out.push("");
      continue;
    }

    const apiSessions = api.sessions ?? [];
    const apiRooms = new Map((api.rooms ?? []).map((r) => [r.id, r.name]));

    const { data: dbRows, error: dbErr } = await supabase
      .from("sessions")
      .select(
        "id, title, starts_at, ends_at, room_id, status, is_service_session, is_plenum_session",
      )
      .eq("event_id", event.id);
    if (dbErr) {
      out.push(`> DB fetch failed: ${dbErr.message}`);
      out.push("");
      continue;
    }
    const dbSessions = (dbRows ?? []) as DbSession[];

    const apiById = new Map(apiSessions.map((s) => [String(s.id), s]));
    const dbById = new Map(dbSessions.map((s) => [String(s.id), s]));

    const allIds = new Set<string>([...apiById.keys(), ...dbById.keys()]);

    const onlyInApi: string[] = [];
    const onlyInDb: string[] = [];
    const inBoth: string[] = [];
    const mismatched: string[] = [];

    const sameTime = (x: string | null | undefined, y: string | null | undefined) => {
      if (!x && !y) return true;
      if (!x || !y) return false;
      const xt = Date.parse(x);
      const yt = Date.parse(y);
      if (Number.isNaN(xt) || Number.isNaN(yt)) return x === y;
      return xt === yt;
    };

    for (const id of allIds) {
      const a = apiById.get(id);
      const d = dbById.get(id);
      if (a && !d) onlyInApi.push(id);
      else if (!a && d) onlyInDb.push(id);
      else if (a && d) {
        inBoth.push(id);
        const apiRoom = a.roomId ?? null;
        const dbRoom = d.room_id ?? null;
        const apiStatus = a.status ?? null;
        const dbStatus = d.status ?? null;
        if (
          a.title !== d.title ||
          !sameTime(a.startsAt, d.starts_at) ||
          !sameTime(a.endsAt, d.ends_at) ||
          apiRoom !== dbRoom ||
          apiStatus !== dbStatus
        ) {
          mismatched.push(id);
        }
      }
    }

    // Counts table
    out.push("### Summary");
    out.push("");
    out.push("| metric | count |");
    out.push("|---|---:|");
    out.push(`| Sessions in Sessionize | ${apiSessions.length} |`);
    out.push(`| Sessions in DB | ${dbSessions.length} |`);
    out.push(`| Present in both | ${inBoth.length} |`);
    out.push(`| **Missing from DB (in Sessionize only)** | **${onlyInApi.length}** |`);
    out.push(`| **Orphans in DB (not in Sessionize)** | **${onlyInDb.length}** |`);
    out.push(`| Present in both but attributes drift | ${mismatched.length} |`);
    out.push("");

    // Status breakdown — Sessionize side
    const statusBreak = new Map<string, number>();
    for (const s of apiSessions) {
      const k = s.status ?? "(null)";
      statusBreak.set(k, (statusBreak.get(k) ?? 0) + 1);
    }
    out.push("### Sessionize status breakdown");
    out.push("");
    out.push("| status | count |");
    out.push("|---|---:|");
    for (const [k, v] of [...statusBreak.entries()].sort()) {
      out.push(`| \`${k}\` | ${v} |`);
    }
    out.push("");

    // Missing-from-DB section
    out.push("### ❌ Sessions in Sessionize but NOT in DB");
    out.push("");
    if (onlyInApi.length === 0) {
      out.push("_None._");
      out.push("");
    } else {
      out.push("| id | title | status | startsAt | room | speakers |");
      out.push("|---|---|---|---|---|---|");
      for (const id of onlyInApi.sort()) {
        const s = apiById.get(id)!;
        const room =
          s.roomId != null ? (apiRooms.get(s.roomId) ?? `id=${s.roomId}`) : "—";
        const speakers = Array.isArray(s.speakers)
          ? s.speakers
              .map((sp) =>
                typeof sp === "string" ? sp.slice(0, 8) : (sp.name ?? sp.id),
              )
              .join(", ")
          : "—";
        out.push(
          `| \`${id.slice(0, 8)}\` | ${escapePipe(s.title)} | ${fmt(s.status)} | ${fmtTime(s.startsAt)} | ${escapePipe(String(room))} | ${escapePipe(speakers)} |`,
        );
      }
      out.push("");
    }

    // Orphans
    out.push("### ⚠ Sessions in DB but NOT in Sessionize (orphans)");
    out.push("");
    if (onlyInDb.length === 0) {
      out.push("_None._");
      out.push("");
    } else {
      out.push("| id | title | status | starts_at | room_id |");
      out.push("|---|---|---|---|---|");
      for (const id of onlyInDb.sort()) {
        const d = dbById.get(id)!;
        out.push(
          `| \`${id.slice(0, 8)}\` | ${escapePipe(d.title ?? "—")} | ${fmt(d.status)} | ${fmtTime(d.starts_at)} | ${fmt(d.room_id)} |`,
        );
      }
      out.push("");
    }

    // Drift
    out.push("### ↔ Sessions in both but with attribute drift");
    out.push("");
    if (mismatched.length === 0) {
      out.push("_None._");
      out.push("");
    } else {
      out.push(
        "| id | title (api / db) | status (api / db) | startsAt (api / db) | room (api / db) |",
      );
      out.push("|---|---|---|---|---|");
      for (const id of mismatched.sort()) {
        const a = apiById.get(id)!;
        const d = dbById.get(id)!;
        const titleCell =
          a.title === d.title
            ? escapePipe(a.title)
            : `${escapePipe(a.title)} **/** ${escapePipe(d.title ?? "—")}`;
        const statusCell =
          (a.status ?? null) === (d.status ?? null)
            ? fmt(a.status)
            : `${fmt(a.status)} **/** ${fmt(d.status)}`;
        const startCell = sameTime(a.startsAt, d.starts_at)
          ? fmtTime(a.startsAt)
          : `${fmtTime(a.startsAt)} **/** ${fmtTime(d.starts_at)}`;
        const roomCell =
          (a.roomId ?? null) === (d.room_id ?? null)
            ? fmt(a.roomId)
            : `${fmt(a.roomId)} **/** ${fmt(d.room_id)}`;
        out.push(
          `| \`${id.slice(0, 8)}\` | ${titleCell} | ${statusCell} | ${startCell} | ${roomCell} |`,
        );
      }
      out.push("");
    }

    // Full side-by-side
    out.push("### Full session list (sorted by Sessionize startsAt)");
    out.push("");
    out.push(
      "| api id | title | startsAt | endsAt | room | status | service | plenum | in DB |",
    );
    out.push("|---|---|---|---|---|---|---|---|---|");

    const sorted = [...apiSessions].sort((a, b) => {
      const av = a.startsAt ?? "";
      const bv = b.startsAt ?? "";
      return av.localeCompare(bv);
    });
    for (const s of sorted) {
      const room =
        s.roomId != null ? (apiRooms.get(s.roomId) ?? `id=${s.roomId}`) : "—";
      const inDb = dbById.has(String(s.id)) ? "✓" : "❌";
      out.push(
        `| \`${String(s.id).slice(0, 8)}\` | ${escapePipe(s.title)} | ${fmtTime(s.startsAt)} | ${fmtTime(s.endsAt)} | ${escapePipe(String(room))} | ${fmt(s.status)} | ${fmt(s.isServiceSession)} | ${fmt(s.isPlenumSession)} | ${inDb} |`,
      );
    }
    out.push("");
  }

  const path = `${process.cwd()}/sessionize-comparison.md`;
  writeFileSync(path, out.join("\n"));
  console.log(`Wrote ${path}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
