import { Card, CardContent } from "@/components/ui/card";
import { Building2, ExternalLink, CheckCircle } from "lucide-react";

interface SponsorCardProps {
  name: string;
  url: string;
  imageUrl: string;
  description?: string;
  visited?: boolean;
}

export function SponsorCard({ name, url, imageUrl, description, visited }: SponsorCardProps) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <Card className={`py-0 transition-colors hover:bg-accent ${visited ? "border-green-500/40" : ""}`}>
        <CardContent className="flex items-center gap-4 p-4">
          {imageUrl ? (
            <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded bg-white p-1">
              <img
                src={imageUrl}
                alt={name}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded bg-muted">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm">{name}</p>
            {description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {description}
              </p>
            )}
          </div>
          {visited ? (
            <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
          ) : (
            <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
        </CardContent>
      </Card>
    </a>
  );
}
