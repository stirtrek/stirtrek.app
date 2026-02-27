import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "staff"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Get all non-service sessions
  const { data: sessions } = await admin
    .from("sessions")
    .select("id, title, starts_at, is_service_session")
    .eq("is_service_session", false)
    .order("starts_at", { ascending: true });

  // Get all feedback with user display names
  const { data: feedback } = await admin
    .from("session_feedback")
    .select("session_id, rating, comment, created_at, profiles(display_name, email)")
    .order("created_at", { ascending: false });

  // Group feedback by session
  const feedbackBySession: Record<
    string,
    {
      rating: string;
      comment: string | null;
      created_at: string;
      user_name: string;
    }[]
  > = {};

  for (const f of feedback ?? []) {
    if (!feedbackBySession[f.session_id]) {
      feedbackBySession[f.session_id] = [];
    }
    const profile = f.profiles as unknown as {
      display_name: string | null;
      email: string;
    } | null;
    feedbackBySession[f.session_id].push({
      rating: f.rating,
      comment: f.comment,
      created_at: f.created_at,
      user_name: profile?.display_name || profile?.email || "Anonymous",
    });
  }

  const result = (sessions ?? []).map((s) => {
    const items = feedbackBySession[s.id] ?? [];
    const green = items.filter((f) => f.rating === "green").length;
    const yellow = items.filter((f) => f.rating === "yellow").length;
    const red = items.filter((f) => f.rating === "red").length;

    return {
      id: s.id,
      title: s.title,
      starts_at: s.starts_at,
      total: items.length,
      green,
      yellow,
      red,
      feedback: items,
    };
  });

  return NextResponse.json({ sessions: result });
}
