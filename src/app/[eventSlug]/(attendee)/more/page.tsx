"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { useEvent } from "@/providers/event-provider";
import { Globe, Twitter } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function AboutPage() {
  const { event } = useEvent();

  return (
    <div className="flex flex-col gap-6">
      {/* Event logo */}
      {event.logo_url && (
        <div className="flex justify-center pt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={event.logo_url}
            alt={event.name}
            className="h-24 w-auto object-contain"
          />
        </div>
      )}

      {/* Event-configurable content */}
      {event.about_content && (
        <div className="prose prose-sm prose-invert max-w-none px-1 [&_p]:text-muted-foreground [&_a]:text-primary [&_a]:underline">
          <ReactMarkdown
            components={{
              a: ({ children, href, ...props }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                  {children}
                </a>
              ),
            }}
          >
            {event.about_content}
          </ReactMarkdown>
        </div>
      )}

      {/* Conference Day */}
      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-start gap-3 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <span className="text-lg font-bold text-primary">CD</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Conference Day</p>
            <p className="text-sm text-muted-foreground">
              This app was built by Conference Day &mdash; we believe every event
              deserves a great attendee experience.
            </p>
            <div className="flex gap-3 pt-2">
              <a
                href="https://conferenceday.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-primary"
                aria-label="Conference Day website"
              >
                <Globe className="h-4 w-4" />
              </a>
              <a
                href="https://x.com/conaboraday"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground transition-colors hover:text-primary"
                aria-label="X (Twitter)"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
