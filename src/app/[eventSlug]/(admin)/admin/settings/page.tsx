"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useEvent } from "@/providers/event-provider";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Info, Loader2, Save, Upload, X } from "lucide-react";
import type { Event } from "@/lib/types";

function FieldInfo({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="ml-1.5 inline-flex items-center text-muted-foreground hover:text-foreground"
        aria-label="More info"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open && (
        <p className="mt-1 text-xs text-muted-foreground">{text}</p>
      )}
    </>
  );
}

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { value: "Europe/London", label: "GMT / London" },
  { value: "Europe/Berlin", label: "CET / Berlin" },
  { value: "Asia/Tokyo", label: "JST / Tokyo" },
  { value: "Australia/Sydney", label: "AEST / Sydney" },
];

export default function AdminSettingsPage() {
  const router = useRouter();
  const { event, eventSlug } = useEvent();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Event | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const iconBgColorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/${eventSlug}/api/admin/settings`)
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [eventSlug]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);

    try {
      const res = await fetch(`/${eventSlug}/api/admin/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settings.name,
          short_name: settings.short_name,
          description: settings.description,
          event_date: settings.event_date,
          event_end_date: settings.event_end_date,
          venue_name: settings.venue_name,
          venue_address: settings.venue_address,
          venue_maps_url: settings.venue_maps_url,
          timezone: settings.timezone,
          sessionize_api_id: settings.sessionize_api_id,
          sponsor_feed_url: settings.sponsor_feed_url,
          sponsor_access_code: settings.sponsor_access_code,
          accent_color: settings.accent_color,
          icon_background_color: settings.icon_background_color,
          logo_url: settings.logo_url,
          schedule_message: settings.schedule_message,
          about_content: settings.about_content,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      } else {
        toast.success("Settings saved");
        // Re-run server layout so EventProvider, header, and favicon get fresh data
        router.refresh();
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const update = (patch: Partial<Event>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));
  };

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

      const res = await fetch(`/${eventSlug}/api/admin/upload-logo`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(`Upload failed: ${data.error}`);
        return;
      }

      update({ logo_url: data.url });
      toast.success("Logo uploaded");
    } catch (err) {
      toast.error(
        `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setUploading(false);
    }
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Event Settings</h1>
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Changes
        </Button>
      </div>

      {/* Basic Info */}
      <Card className="gap-0 py-0">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm">Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="name">Event Name</Label>
              <FieldInfo text="Displayed on the home screen, login page, browser tab, and PWA app name." />
            </div>
            <Input
              id="name"
              value={settings.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="short-name">Short Name</Label>
              <FieldInfo text="Used as the app name when installed on a phone's home screen (PWA). Keep it short — e.g. 'ST' or 'BACon'." />
            </div>
            <Input
              id="short-name"
              value={settings.short_name || ""}
              onChange={(e) => update({ short_name: e.target.value || null })}
              placeholder="e.g. ST"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="description">Description</Label>
              <FieldInfo text="Shown in search results and social media previews when sharing event links." />
            </div>
            <Textarea
              id="description"
              value={settings.description || ""}
              onChange={(e) => update({ description: e.target.value || null })}
              rows={3}
            />
          </div>

          {/* Event Logo */}
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label>Event Logo</Label>
              <FieldInfo text="Shown on the login screen, home page, app header, browser favicon, and the About page." />
            </div>
            {settings.logo_url ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={settings.logo_url}
                  alt="Event logo"
                  className="h-16 w-auto rounded border border-white/10 bg-white/5 object-contain p-1"
                />
                <button
                  type="button"
                  onClick={() => update({ logo_url: null })}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                  Remove
                </button>
              </div>
            ) : (
              <>
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
              </>
            )}
            <p className="text-xs text-muted-foreground">
              PNG or SVG recommended. Max 2MB.
            </p>
          </div>

          {/* Accent Color */}
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label>Accent Color</Label>
              <FieldInfo text="Applied to buttons, links, and highlights throughout your event's pages." />
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={colorInputRef}
                type="color"
                value={settings.accent_color || "#FF3B3B"}
                onChange={(e) => update({ accent_color: e.target.value })}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => colorInputRef.current?.click()}
                className="h-10 w-10 shrink-0 rounded-full border-2 border-white/20 transition-transform hover:scale-110"
                style={{ backgroundColor: settings.accent_color || "#FF3B3B" }}
                title="Pick a color"
              />
              <Input
                value={settings.accent_color || "#FF3B3B"}
                onChange={(e) => update({ accent_color: e.target.value })}
                className="w-28 font-mono text-xs"
                placeholder="#FF3B3B"
              />
            </div>
          </div>

          {/* Icon Background Color */}
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label>Icon Background Color</Label>
              <FieldInfo text="Background color shown behind your logo when the app is installed on a phone's home screen (PWA icon). Choose a color that contrasts well with your logo." />
            </div>
            <div className="flex items-center gap-3">
              <input
                ref={iconBgColorInputRef}
                type="color"
                value={settings.icon_background_color || "#ffffff"}
                onChange={(e) => update({ icon_background_color: e.target.value })}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => iconBgColorInputRef.current?.click()}
                className="h-10 w-10 shrink-0 rounded-full border-2 border-white/20 transition-transform hover:scale-110"
                style={{ backgroundColor: settings.icon_background_color || "#ffffff" }}
                title="Pick a color"
              />
              <Input
                value={settings.icon_background_color || "#ffffff"}
                onChange={(e) => update({ icon_background_color: e.target.value })}
                className="w-28 font-mono text-xs"
                placeholder="#ffffff"
              />
            </div>
            {settings.logo_url && (
              <div className="mt-2">
                <p className="mb-1.5 text-xs text-muted-foreground">Preview:</p>
                <div
                  className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10"
                  style={{ backgroundColor: settings.icon_background_color || "#ffffff" }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={settings.logo_url}
                    alt="Icon preview"
                    className="h-12 w-12 object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Date & Venue */}
      <Card className="gap-0 py-0">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm">Date & Venue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center">
                <Label htmlFor="event-date">Start Date</Label>
                <FieldInfo text="Displayed on the home screen. Multi-day events show a date range." />
              </div>
              <Input
                id="event-date"
                type="date"
                value={settings.event_date || ""}
                onChange={(e) => update({ event_date: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end-date">End Date</Label>
              <Input
                id="event-end-date"
                type="date"
                value={settings.event_end_date || ""}
                onChange={(e) =>
                  update({ event_end_date: e.target.value || null })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="timezone">Timezone</Label>
              <FieldInfo text="All session times are displayed in this timezone." />
            </div>
            <select
              id="timezone"
              value={settings.timezone}
              onChange={(e) => update({ timezone: e.target.value })}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="venue-name">Venue Name</Label>
              <FieldInfo text="Shown on the home page with a link to directions." />
            </div>
            <Input
              id="venue-name"
              value={settings.venue_name || ""}
              onChange={(e) => update({ venue_name: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="venue-address">Venue Address</Label>
              <FieldInfo text="Used to generate a Google Maps directions link on the home page." />
            </div>
            <Input
              id="venue-address"
              value={settings.venue_address || ""}
              onChange={(e) => update({ venue_address: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="venue-maps">Maps URL</Label>
              <FieldInfo text="Custom maps link. If blank, one is auto-generated from the venue address." />
            </div>
            <Input
              id="venue-maps"
              type="url"
              value={settings.venue_maps_url || ""}
              onChange={(e) =>
                update({ venue_maps_url: e.target.value || null })
              }
              placeholder="https://maps.google.com/..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card className="gap-0 py-0">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm">Integrations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="sessionize">Sessionize API ID</Label>
              <FieldInfo text="Your Sessionize event's API identifier. Used to sync sessions and speakers." />
            </div>
            <Input
              id="sessionize"
              value={settings.sessionize_api_id || ""}
              onChange={(e) =>
                update({ sessionize_api_id: e.target.value || null })
              }
              placeholder="abc123"
            />
            <p className="text-xs text-muted-foreground">
              Find this in{" "}
              <a
                href="https://sessionize.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Sessionize
              </a>
              : go to your event &rarr; API / Integrations &rarr; copy the ID
              from any endpoint URL.
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="sponsor-feed">Sponsor Feed URL</Label>
              <FieldInfo text="URL to a JSON feed of sponsor data. Used to auto-populate the Sponsors page." />
            </div>
            <Input
              id="sponsor-feed"
              type="url"
              value={settings.sponsor_feed_url || ""}
              onChange={(e) =>
                update({ sponsor_feed_url: e.target.value || null })
              }
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="sponsor-code">Sponsor Access Code</Label>
              <FieldInfo text="Code that sponsors enter to access lead-scanning features." />
            </div>
            <Input
              id="sponsor-code"
              value={settings.sponsor_access_code || ""}
              onChange={(e) =>
                update({ sponsor_access_code: e.target.value || null })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      <Card className="gap-0 py-0">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm">Content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4">
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="schedule-message">Schedule Message</Label>
              <FieldInfo text="Banner text shown at the top of the My Schedule tab. Supports markdown links." />
            </div>
            <Textarea
              id="schedule-message"
              value={settings.schedule_message || ""}
              onChange={(e) =>
                update({ schedule_message: e.target.value || null })
              }
              rows={2}
              placeholder="Shown at the top of the schedule page"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label htmlFor="about-content">About Page (Markdown)</Label>
              <FieldInfo text="Content shown on the About page below the event logo. Supports full markdown." />
            </div>
            <Textarea
              id="about-content"
              value={settings.about_content || ""}
              onChange={(e) =>
                update({ about_content: e.target.value || null })
              }
              rows={4}
              placeholder="Markdown content for the About page"
            />
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
