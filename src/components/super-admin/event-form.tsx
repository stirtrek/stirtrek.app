"use client";

import { useState, useRef } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Event, EventFeatureFlags } from "@/lib/types";

const DEFAULT_FLAGS: EventFeatureFlags = {
  polls: false,
  emergency_reporting: false,
  sponsor_leads: false,
  announcements: false,
  feedback: false,
  venue_map: false,
  passport: false,
  attendance: false,
};

const ACCENT_PRESETS = [
  { color: "#FF3B3B", label: "Red" },
  { color: "#0169AC", label: "Blue" },
  { color: "#c48c2f", label: "Gold" },
  { color: "#8e203a", label: "Dark Red" },
  { color: "#22c55e", label: "Green" },
  { color: "#8b5cf6", label: "Purple" },
];

const FLAG_LABELS: Record<keyof EventFeatureFlags, string> = {
  polls: "Polls",
  emergency_reporting: "Emergency Reporting",
  sponsor_leads: "Sponsor Lead Scanning",
  announcements: "Announcements",
  feedback: "Session Feedback",
  venue_map: "Venue Map",
  passport: "Passport / Gamification",
  attendance: "Proctor Attendance Counting",
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
  const [accentColor, setAccentColor] = useState(event?.accent_color ?? "#FF3B3B");
  const [domain, setDomain] = useState(event?.domain ?? "");
  const [scheduleMessage, setScheduleMessage] = useState(event?.schedule_message ?? "");
  const [aboutContent, setAboutContent] = useState(event?.about_content ?? "");
  const [logoUrl, setLogoUrl] = useState(event?.logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isActive, setIsActive] = useState(event?.is_active ?? true);
  const [showOnMarketing, setShowOnMarketing] = useState(event?.show_on_marketing ?? false);
  const [flags, setFlags] = useState<EventFeatureFlags>(
    event?.feature_flags ?? DEFAULT_FLAGS,
  );

  async function handleLogoUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("slug", slug || "event");

      const res = await fetch("/api/super-admin/upload-logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(`Upload failed: ${data.error}`);
        return;
      }

      setLogoUrl(data.url);
      toast.success("Logo uploaded");
    } catch (err) {
      console.error("Logo upload error:", err);
      toast.error(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUploading(false);
    }
  }

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
      accent_color: accentColor || "#FF3B3B",
      schedule_message: scheduleMessage || null,
      about_content: aboutContent || null,
      domain: domain || null,
      logo_url: logoUrl || null,
      is_active: isActive,
      show_on_marketing: showOnMarketing,
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
            <Label>Event Logo</Label>
            {logoUrl ? (
              <div className="mt-1.5 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt="Event logo"
                  className="h-16 w-auto rounded border border-white/10 bg-white/5 object-contain p-1"
                />
                <button
                  type="button"
                  onClick={() => setLogoUrl("")}
                  className="text-muted-foreground hover:text-destructive flex items-center gap-1 text-xs"
                >
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </div>
            ) : (
              <div className="mt-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 rounded-md border border-dashed border-white/20 px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-white/40 hover:text-white disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {uploading ? "Uploading..." : "Upload logo"}
                </button>
              </div>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              PNG or SVG recommended. Max 2MB.
            </p>
          </div>
          <div>
            <Label>Accent Color</Label>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  type="button"
                  title={preset.label}
                  onClick={() => setAccentColor(preset.color)}
                  className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: preset.color,
                    borderColor:
                      accentColor === preset.color
                        ? "#F4F6F8"
                        : "transparent",
                    boxShadow:
                      accentColor === preset.color
                        ? "0 0 0 2px rgba(244,246,248,0.3)"
                        : "none",
                  }}
                />
              ))}
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="w-28 font-mono text-xs"
                placeholder="#FF3B3B"
              />
              <div
                className="h-8 w-8 rounded-full border border-white/20"
                style={{ backgroundColor: accentColor }}
              />
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              Used for buttons and highlights on the event&apos;s pages.
            </p>
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
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="show_on_marketing"
              checked={showOnMarketing}
              onChange={(e) => setShowOnMarketing(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-gray-800"
            />
            <Label htmlFor="show_on_marketing" className="text-sm font-normal">
              Show on marketing site
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
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="America/New_York">Eastern (America/New_York)</option>
              <option value="America/Chicago">Central (America/Chicago)</option>
              <option value="America/Denver">Mountain (America/Denver)</option>
              <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
              <option value="America/Anchorage">Alaska (America/Anchorage)</option>
              <option value="Pacific/Honolulu">Hawaii (Pacific/Honolulu)</option>
              <option value="America/Phoenix">Arizona (America/Phoenix)</option>
              <option value="America/Indiana/Indianapolis">Indiana (America/Indiana/Indianapolis)</option>
              <option value="Europe/London">London (Europe/London)</option>
              <option value="Europe/Berlin">Berlin (Europe/Berlin)</option>
              <option value="Europe/Paris">Paris (Europe/Paris)</option>
              <option value="Asia/Tokyo">Tokyo (Asia/Tokyo)</option>
              <option value="Asia/Shanghai">Shanghai (Asia/Shanghai)</option>
              <option value="Australia/Sydney">Sydney (Australia/Sydney)</option>
            </select>
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

      {/* Content */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="schedule_message">My Schedule Message</Label>
            <Textarea
              id="schedule_message"
              value={scheduleMessage}
              onChange={(e) => setScheduleMessage(e.target.value)}
              placeholder="Can't decide? Watch recordings on [our YouTube](https://youtube.com) after the event."
              rows={3}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Shown on the My Schedule tab. Supports markdown links: [text](url). Leave blank to hide.
            </p>
          </div>
          <div>
            <Label htmlFor="about_content">About Page Content</Label>
            <Textarea
              id="about_content"
              value={aboutContent}
              onChange={(e) => setAboutContent(e.target.value)}
              placeholder="Welcome to our event! Visit [our website](https://example.com) for more info."
              rows={5}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Shown on the About page below the event logo. Supports markdown. Leave blank to hide.
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
