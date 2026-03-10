"use client";

import { useState, useEffect } from "react";
import { useEvent } from "@/providers/event-provider";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Save } from "lucide-react";
import type { Event } from "@/lib/types";

const ACCENT_PRESETS = [
  { color: "#FF3B3B", label: "Red" },
  { color: "#0169AC", label: "Blue" },
  { color: "#c48c2f", label: "Gold" },
  { color: "#0ea5e9", label: "Sky" },
  { color: "#22c55e", label: "Green" },
  { color: "#8b5cf6", label: "Purple" },
];

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
  const { event, eventSlug, eventPath } = useEvent();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Event | null>(null);

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
          schedule_message: settings.schedule_message,
          about_content: settings.about_content,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to save");
      } else {
        toast.success("Settings saved");
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
            <Label htmlFor="name">Event Name</Label>
            <Input
              id="name"
              value={settings.name}
              onChange={(e) => update({ name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="short-name">Short Name</Label>
            <Input
              id="short-name"
              value={settings.short_name || ""}
              onChange={(e) => update({ short_name: e.target.value || null })}
              placeholder="e.g. ST"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={settings.description || ""}
              onChange={(e) => update({ description: e.target.value || null })}
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Accent Color</Label>
            <div className="flex flex-wrap gap-2">
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.color}
                  onClick={() => update({ accent_color: preset.color })}
                  className={`h-8 w-8 rounded-full border-2 ${
                    settings.accent_color === preset.color
                      ? "border-slate-900 ring-2 ring-offset-2"
                      : "border-slate-200"
                  }`}
                  style={{ backgroundColor: preset.color }}
                  title={preset.label}
                />
              ))}
            </div>
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
              <Label htmlFor="event-date">Start Date</Label>
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
                onChange={(e) => update({ event_end_date: e.target.value || null })}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
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
            <Label htmlFor="venue-name">Venue Name</Label>
            <Input
              id="venue-name"
              value={settings.venue_name || ""}
              onChange={(e) => update({ venue_name: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="venue-address">Venue Address</Label>
            <Input
              id="venue-address"
              value={settings.venue_address || ""}
              onChange={(e) => update({ venue_address: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="venue-maps">Maps URL</Label>
            <Input
              id="venue-maps"
              type="url"
              value={settings.venue_maps_url || ""}
              onChange={(e) => update({ venue_maps_url: e.target.value || null })}
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
            <Label htmlFor="sessionize">Sessionize API ID</Label>
            <Input
              id="sessionize"
              value={settings.sessionize_api_id || ""}
              onChange={(e) => update({ sessionize_api_id: e.target.value || null })}
              placeholder="abc123"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sponsor-feed">Sponsor Feed URL</Label>
            <Input
              id="sponsor-feed"
              type="url"
              value={settings.sponsor_feed_url || ""}
              onChange={(e) => update({ sponsor_feed_url: e.target.value || null })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sponsor-code">Sponsor Access Code</Label>
            <Input
              id="sponsor-code"
              value={settings.sponsor_access_code || ""}
              onChange={(e) => update({ sponsor_access_code: e.target.value || null })}
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
            <Label htmlFor="schedule-message">Schedule Message</Label>
            <Textarea
              id="schedule-message"
              value={settings.schedule_message || ""}
              onChange={(e) => update({ schedule_message: e.target.value || null })}
              rows={2}
              placeholder="Shown at the top of the schedule page"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="about-content">About Page (Markdown)</Label>
            <Textarea
              id="about-content"
              value={settings.about_content || ""}
              onChange={(e) => update({ about_content: e.target.value || null })}
              rows={4}
              placeholder="Markdown content for the About page"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
