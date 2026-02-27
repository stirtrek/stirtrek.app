import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookmarkButton } from "@/components/schedule/bookmark-button";
import { MapPin, Clock, ArrowLeft, MessageSquare, User } from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { SessionWithDetails } from "@/lib/types";

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { sessionId } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("sessions")
    .select("title")
    .eq("id", sessionId)
    .single();

  return {
    title: data?.title || "Session",
  };
}

export default async function SessionDetailPage({ params }: PageProps) {
  const { sessionId } = await params;
  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("sessions")
    .select(
      `
      *,
      room:rooms(*),
      speakers:session_speakers(speaker:speakers(*)),
      categories:session_categories(category_item:category_items(*))
    `
    )
    .eq("id", sessionId)
    .single();

  if (!session) {
    notFound();
  }

  const authClient = await createClient();
  const { data: { user } } = await authClient.auth.getUser();

  // Transform join data
  const s: SessionWithDetails = {
    ...session,
    room: session.room || null,
    speakers: (session.speakers || [])
      .map((j: { speaker: unknown }) => j.speaker)
      .filter(Boolean),
    categories: (session.categories || [])
      .map((j: { category_item: unknown }) => j.category_item)
      .filter(Boolean),
  } as SessionWithDetails;

  const startTime = s.starts_at ? formatTime(s.starts_at) : null;
  const endTime = s.ends_at ? formatTime(s.ends_at) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/schedule">
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-xl font-bold leading-tight">{s.title}</h1>
          {!s.is_service_session && user && <BookmarkButton sessionId={s.id} />}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {startTime && endTime && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {startTime} - {endTime}
            </span>
          )}
          {s.room && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {s.room.name}
            </span>
          )}
        </div>

        {s.categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {s.categories.map((cat) => (
              <Badge key={cat.id} variant="secondary">
                {cat.name}
              </Badge>
            ))}
          </div>
        )}

        {s.description && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {s.description}
              </p>
            </CardContent>
          </Card>
        )}

        {s.speakers.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">
              {s.speakers.length === 1 ? "Speaker" : "Speakers"}
            </h2>
            {s.speakers.map((speaker) => (
              <Link key={speaker.id} href={`/speakers/${speaker.id}`}>
                <Card className="transition-colors hover:bg-accent">
                  <CardContent className="flex items-center gap-3 p-4">
                    {speaker.profile_picture ? (
                      <Image
                        src={speaker.profile_picture}
                        alt={speaker.full_name}
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                        <User className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{speaker.full_name}</p>
                      {speaker.tag_line && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {speaker.tag_line}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {!s.is_service_session && user && (
          <Link href={`/schedule/${s.id}/feedback`}>
            <Button variant="outline" className="w-full">
              <MessageSquare className="mr-2 h-4 w-4" />
              Leave Feedback
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
