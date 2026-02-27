import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToAdmins } from "@/lib/push";

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

  const isAdmin = profile && ["admin", "staff"].includes(profile.role);
  const admin = createAdminClient();

  if (isAdmin) {
    const { data: messages, error } = await admin
      .from("emergency_messages")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const messageIds = (messages ?? []).map((m) => m.id);
    const userIds = [...new Set((messages ?? []).map((m) => m.user_id))];

    const [{ data: profiles }, { data: replies }] = await Promise.all([
      admin
        .from("profiles")
        .select("id, display_name, first_name, last_name, email")
        .in("id", userIds.length > 0 ? userIds : ["no-match"]),
      admin
        .from("emergency_replies")
        .select("*")
        .in("message_id", messageIds.length > 0 ? messageIds : ["no-match"])
        .order("created_at", { ascending: true }),
    ]);

    // Fetch profiles for all reply senders
    const replySenderIds = [
      ...new Set((replies ?? []).map((r) => r.sender_id)),
    ];
    const { data: replySenderProfiles } = replySenderIds.length > 0
      ? await admin
          .from("profiles")
          .select("id, display_name, first_name, last_name, email, role")
          .in("id", replySenderIds)
      : { data: [] };

    const profileMap = new Map(
      (profiles ?? []).map((p) => [p.id, p])
    );
    const replySenderMap = new Map(
      (replySenderProfiles ?? []).map((p) => [p.id, p])
    );

    const enriched = (messages ?? []).map((m) => {
      const sender = profileMap.get(m.user_id);
      const messageReplies = (replies ?? [])
        .filter((r) => r.message_id === m.id)
        .map((r) => ({
          ...r,
          reply_sender: replySenderMap.get(r.sender_id) ?? undefined,
        }));

      return {
        ...m,
        sender: sender
          ? {
              display_name: sender.display_name,
              first_name: sender.first_name,
              last_name: sender.last_name,
              email: sender.email,
            }
          : undefined,
        replies: messageReplies,
      };
    });

    return NextResponse.json({ messages: enriched });
  }

  // Attendee: fetch own messages with replies
  const { data: messages, error } = await supabase
    .from("emergency_messages")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const messageIds = (messages ?? []).map((m) => m.id);

  const { data: replies } = messageIds.length > 0
    ? await supabase
        .from("emergency_replies")
        .select("*")
        .in("message_id", messageIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  // Fetch profiles for reply senders (could be admins or the user themselves)
  const replySenderIds = [...new Set((replies ?? []).map((r) => r.sender_id))];
  const { data: replySenderProfiles } = replySenderIds.length > 0
    ? await admin
        .from("profiles")
        .select("id, display_name, first_name, last_name, email, role")
        .in("id", replySenderIds)
    : { data: [] };

  const replySenderMap = new Map(
    (replySenderProfiles ?? []).map((p) => [p.id, p])
  );

  const enriched = (messages ?? []).map((m) => ({
    ...m,
    replies: (replies ?? [])
      .filter((r) => r.message_id === m.id)
      .map((r) => ({
        ...r,
        reply_sender: replySenderMap.get(r.sender_id) ?? undefined,
      })),
  }));

  return NextResponse.json({ messages: enriched });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const message = (body.message || "").trim();

  if (!message) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  if (message.length > 1000) {
    return NextResponse.json(
      { error: "Message must be 1000 characters or less" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("emergency_messages")
    .insert({ user_id: user.id, message })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send push notification to all admins (fire-and-forget)
  const preview = message.length > 80 ? message.slice(0, 80) + "…" : message;
  sendPushToAdmins({
    title: "Emergency Report",
    body: preview,
    url: "/admin/emergency",
  }).catch(() => {});

  return NextResponse.json(data, { status: 201 });
}
