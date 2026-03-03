"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Event, EventFeatureFlags } from "@/lib/types";

const DEFAULT_FLAGS: EventFeatureFlags = {
  polls: false,
  movie_voting: false,
  emergency_reporting: false,
  sponsor_leads: false,
  announcements: false,
  feedback: false,
  venue_map: false,
  passport: false,
};

const FLAG_LABELS: Record<keyof EventFeatureFlags, string> = {
  polls: "Polls",
  movie_voting: "Movie Voting",
  emergency_reporting: "Emergency Reporting",
  sponsor_leads: "Sponsor Lead Scanning",
  announcements: "Announcements",
  feedback: "Session Feedback",
  venue_map: "Venue Map",
  passport: "Passport / Gamification",
};

interface EventFormProps {
  event?: Event;
  onSubmit: (data: Partial<Event>) => Promise<void>;
  saving: boolean;
}

export function EventForm({ event, onSubmit, saving }: EventFormProps) {
  const [name, setName] = useState(event?.name ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [shortName, setShortName] = useState(event?.short_name ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [eventDate, setEventDate] = useState(event?.event_date ?? "");
  const [eventEndDate, setEventEndDate] = useState(event?.event_end_date ?? "");
  const [venueName, setVenueName] = useState(event?.venue_name ?? "");
  const [venueAddress, setVenueAddress] = useState(event?.venue_address ?? "");
  const [venueMapsUrl, setVenueMapsUrl] = useState(event?.venue_maps_url ?? "");
  const [timezone, setTimezone] = useState(event?.timezone ?? "America/New_York");
  const [sessionizeApiId, setSessionizeApiId] = useState(event?.sessionize_api_id ?? "");
  const [sponsorFeedUrl, setSponsorFeedUrl] = useState(event?.sponsor_feed_url ?? "");
  const [sponsorAccessCode, setSponsorAccessCode] = useState(event?.sponsor_access_code ?? "");
  const [domain, setDomain] = useState(event?.domain ?? "");
  const [logoUrl, setLogoUrl] = useState(event?.logo_url ?? "");
  const [isActive, setIsActive] = useState(event?.is_active ?? true);
  const [flags, setFlags] = useState<EventFeatureFlags>(
    event?.feature_flags ?? DEFAULT_FLAGS,
  );

  function toggleFlag(key: keyof EventFeatureFlags) {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      slug,
      short_name: shortName || null,
      description: description || null,
      event_date: eventDate || null,
      event_end_date: eventEndDate || null,
      venue_name: venueName || null,
      venue_address: venueAddress || null,
      venue_maps_url: venueMapsUrl || null,
      timezone,
      sessionize_api_id: sessionizeApiId || null,
      sponsor_feed_url: sponsorFeedUrl || null,
      sponsor_access_code: sponsorAccessCode || null,
      domain: domain || null,
      logo_url: logoUrl || null,
      is_active: isActive,
      feature_flags: flags,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Basic Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="name">Event Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Stir Trek 2026"
              required
            />
          </div>
          <div>
            <Label htmlFor="slug">URL Slug *</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="stirtrek"
              required
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Used in URLs: app.example.com/<strong>{slug || "slug"}</strong>/schedule
            </p>
          </div>
          <div>
            <Label htmlFor="short_name">Short Name (PWA)</Label>
            <Input
              id="short_name"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="Stir Trek"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A conference about..."
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="logo_url">Logo URL</Label>
            <Input
              id="logo_url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800"
            />
            <Label htmlFor="is_active" className="text-sm font-normal">
              Event is active
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Date & Venue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Date & Venue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="event_date">Start Date</Label>
              <Input
                id="event_date"
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="event_end_date">End Date</Label>
              <Input
                id="event_end_date"
                type="date"
                value={eventEndDate}
                onChange={(e) => setEventEndDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/New_York"
            />
          </div>
          <div>
            <Label htmlFor="venue_name">Venue Name</Label>
            <Input
              id="venue_name"
              value={venueName}
              onChange={(e) => setVenueName(e.target.value)}
              placeholder="Convention Center"
            />
          </div>
          <div>
            <Label htmlFor="venue_address">Venue Address</Label>
            <Input
              id="venue_address"
              value={venueAddress}
              onChange={(e) => setVenueAddress(e.target.value)}
              placeholder="123 Main St, City, ST 12345"
            />
          </div>
          <div>
            <Label htmlFor="venue_maps_url">Venue Maps URL</Label>
            <Input
              id="venue_maps_url"
              value={venueMapsUrl}
              onChange={(e) => setVenueMapsUrl(e.target.value)}
              placeholder="https://maps.google.com/..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Custom Domain */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Custom Domain</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="domain">Domain</Label>
            <Input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value.toLowerCase())}
              placeholder="myevent.com"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Point this domain&apos;s DNS to your Vercel deployment. Users visiting
              this domain will see this event without needing the slug in the URL.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="sessionize_api_id">Sessionize API ID</Label>
            <Input
              id="sessionize_api_id"
              value={sessionizeApiId}
              onChange={(e) => setSessionizeApiId(e.target.value)}
              placeholder="abc123..."
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Leave blank to enter sessions manually.
            </p>
          </div>
          <div>
            <Label htmlFor="sponsor_feed_url">Sponsor Feed URL</Label>
            <Input
              id="sponsor_feed_url"
              value={sponsorFeedUrl}
              onChange={(e) => setSponsorFeedUrl(e.target.value)}
              placeholder="https://example.com/sponsors.json"
            />
          </div>
          <div>
            <Label htmlFor="sponsor_access_code">Sponsor Access Code</Label>
            <Input
              id="sponsor_access_code"
              value={sponsorAccessCode}
              onChange={(e) => setSponsorAccessCode(e.target.value)}
              placeholder="secret-code-123"
            />
          </div>
        </CardContent>
      </Card>

      {/* Feature Flags */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-y-2">
            {(Object.keys(FLAG_LABELS) as (keyof EventFeatureFlags)[]).map(
              (key) => (
                <div key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`flag-${key}`}
                    checked={flags[key]}
                    onChange={() => toggleFlag(key)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-800"
                  />
                  <Label
                    htmlFor={`flag-${key}`}
                    className="text-sm font-normal"
                  >
                    {FLAG_LABELS[key]}
                  </Label>
                </div>
              ),
            )}
          </div>
        </CardContent>
      </Card>

      <Button type="submit" className="w-full" disabled={saving || !name || !slug}>
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : event ? (
          "Save Changes"
        ) : (
          "Create Event"
        )}
      </Button>
    </form>
  );
}
