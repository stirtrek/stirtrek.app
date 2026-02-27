import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { User } from "lucide-react";
import type { Speaker } from "@/lib/types";

interface SpeakerCardProps {
  speaker: Speaker;
}

export function SpeakerCard({ speaker }: SpeakerCardProps) {
  return (
    <Link href={`/speakers/${speaker.id}`}>
      <Card className="py-0 transition-colors hover:bg-accent">
        <CardContent className="flex items-center gap-4 p-4">
          {speaker.profile_picture ? (
            <img
              src={speaker.profile_picture}
              alt={speaker.full_name}
              className="h-20 w-20 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-muted">
              <User className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{speaker.full_name}</p>
            {speaker.tag_line && (
              <p className="text-xs text-muted-foreground line-clamp-1">
                {speaker.tag_line}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
