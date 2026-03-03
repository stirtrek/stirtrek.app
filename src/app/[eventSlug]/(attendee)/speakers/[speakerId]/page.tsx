import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  User,
  Globe,
  Twitter,
  Linkedin,
  ExternalLink,
} from "lucide-react";
import { formatTime } from "@/lib/utils";
import type { Speaker, SessionWithDetails } from "@/lib/types";

interface PageProps {
  params: Promise<{ eventSlug: string; speakerId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { speakerId } = await params;
  // eventSlug not needed for metadata
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("speakers")
    .select("full_name")
    .eq("id", speakerId)
    .single();

  return {
    title: data?.full_name || "Speaker",
  };
}

function getLinkIcon(linkType: string) {
  switch (linkType.toLowerCase()) {
    case "twitter":
      return <Twitter className="h-4 w-4" />;
    case "linkedin":
      return <Linkedin className="h-4 w-4" />;
    case "blog":
    case "company_website":
      return <Globe className="h-4 w-4" />;
    default:
      return <ExternalLink className="h-4 w-4" />;
  }
}

export default async function SpeakerDetailPage({ params }: PageProps) {
  const { eventSlug, speakerId } = await params;
  const supabase = createAdminClient();

  const { data: speaker } = await supabase
    .from("speakers")
    .select("*")
    .eq("id", speakerId)
    .single();

  if (!speaker) {
    notFound();
  }

  const s = speaker as Speaker;

  // Fetch sessions for this speaker
  const { data: sessionLinks } = await supabase
    .from("session_speakers")
    .select(
      `
      session:sessions(
        *,
        room:rooms(*),
        speakers:session_speakers(speaker:speakers(*)),
        categories:session_categories(category_item:category_items(*))
      )
    `
    )
    .eq("speaker_id", speakerId);

  const sessions: SessionWithDetails[] = (sessionLinks || [])
    .map((link: Record<string, unknown>) => {
      const sess = link.session as Record<string, unknown> | null;
      if (!sess) return null;
      const { speakers: speakerJoin, categories: categoryJoin, room, ...session } = sess;
      return {
        ...session,
        room: room || null,
        speakers: (speakerJoin as { speaker: unknown }[] || [])
          .map((j) => j.speaker)
          .filter(Boolean),
        categories: (categoryJoin as { category_item: unknown }[] || [])
          .map((j) => j.category_item)
          .filter(Boolean),
      } as SessionWithDetails;
    })
    .filter(Boolean) as SessionWithDetails[];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/${eventSlug}/speakers`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <div className="flex items-start gap-4">
        {s.profile_picture ? (
          <Image
            src={s.profile_picture}
            alt={s.full_name}
            width={80}
            height={80}
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
            <User className="h-10 w-10 text-muted-foreground" />
          </div>
        )}
        <div className="space-y-1">
          <h1 className="text-xl font-bold">{s.full_name}</h1>
          {s.tag_line && (
            <p className="text-sm text-muted-foreground">{s.tag_line}</p>
          )}
          {s.is_top_speaker && (
            <Badge variant="default">Featured Speaker</Badge>
          )}
        </div>
      </div>

      {s.links && s.links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {s.links.map((link, i) => (
            <a
              key={i}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm">
                {getLinkIcon(link.linkType)}
                <span className="ml-1">{link.title}</span>
              </Button>
            </a>
          ))}
        </div>
      )}

      {s.bio && (
        <Card>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {s.bio}
            </p>
          </CardContent>
        </Card>
      )}

      {sessions.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {sessions.length === 1 ? "Session" : "Sessions"}
          </h2>
          {sessions.map((session) => (
            <Link key={session.id} href={`/${eventSlug}/schedule/${session.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="p-4">
                  <p className="font-medium text-sm">{session.title}</p>
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                    {session.starts_at && (
                      <span>
                        {formatTime(session.starts_at)}
                      </span>
                    )}
                    {session.room && <span>{session.room.name}</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
