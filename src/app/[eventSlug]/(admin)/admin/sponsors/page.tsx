"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Upload,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { useEvent } from "@/providers/event-provider";
import { DEFAULT_SPONSOR_TIERS } from "@/lib/constants";
import type { Sponsor, SponsorTier, SponsorTierConfig } from "@/lib/types";

type Tab = "sponsors" | "tiers";

// Palette for dynamically assigning badge colors by tier index
const TIER_COLOR_PALETTE = [
  "bg-purple-500/20 text-purple-300",
  "bg-yellow-500/20 text-yellow-300",
  "bg-gray-400/20 text-gray-300",
  "bg-orange-500/20 text-orange-300",
  "bg-blue-500/20 text-blue-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-pink-500/20 text-pink-300",
  "bg-cyan-500/20 text-cyan-300",
];

function getTierColor(tiers: SponsorTierConfig[], tierKey: string): string {
  const idx = tiers.findIndex((t) => t.key === tierKey);
  if (idx === -1) return "bg-muted text-muted-foreground";
  return TIER_COLOR_PALETTE[idx % TIER_COLOR_PALETTE.length];
}

// ──────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────

export default function AdminSponsorsPage() {
  const { event, eventSlug } = useEvent();
  const [tab, setTab] = useState<Tab>("sponsors");
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchSponsors = useCallback(async () => {
    try {
      const res = await fetch(`/${eventSlug}/api/admin/sponsors`);
      if (res.ok) {
        const data = await res.json();
        setSponsors(data.sponsors ?? []);
      }
    } catch {
      // handled in tabs
    } finally {
      setLoading(false);
    }
  }, [eventSlug]);

  useEffect(() => {
    fetchSponsors();
  }, [fetchSponsors]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/${eventSlug}/api/admin/sponsors/sync`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      toast.success(`Synced ${data.synced} sponsors from feed`);
      await fetchSponsors();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to sync sponsors",
      );
    } finally {
      setSyncing(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "sponsors", label: "Sponsors" },
    { key: "tiers", label: "Tiers" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <h1 className="text-2xl font-bold">Sponsors</h1>
        {event.sponsor_feed_url && (
          <Button onClick={handleSync} disabled={syncing} size="sm">
            {syncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Sponsors
              </>
            )}
          </Button>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
            {t.key === "sponsors" && !loading && ` (${sponsors.length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {tab === "sponsors" && (
            <SponsorsTab
              sponsors={sponsors}
              eventSlug={eventSlug}
              onRefresh={fetchSponsors}
            />
          )}
          {tab === "tiers" && <TiersTab eventSlug={eventSlug} />}
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// SPONSORS TAB (CRUD)
// ──────────────────────────────────────────

function SponsorsTab({
  sponsors,
  eventSlug,
  onRefresh,
}: {
  sponsors: Sponsor[];
  eventSlug: string;
  onRefresh: () => void;
}) {
  const { event } = useEvent();
  const tiers = event.sponsor_tiers ?? DEFAULT_SPONSOR_TIERS;
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tier, setTier] = useState<SponsorTier>(tiers[0]?.key ?? "gold");
  const [logoUrl, setLogoUrl] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [boothLocation, setBoothLocation] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setName("");
    setTier(tiers[0]?.key ?? "gold");
    setLogoUrl("");
    setDescription("");
    setWebsiteUrl("");
    setBoothLocation("");
    setSortOrder("0");
    setIsActive(true);
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(sponsor: Sponsor) {
    setName(sponsor.name);
    setTier(sponsor.tier);
    setLogoUrl(sponsor.logo_url ?? "");
    setDescription(sponsor.description ?? "");
    setWebsiteUrl(sponsor.website_url ?? "");
    setBoothLocation(sponsor.booth_location ?? "");
    setSortOrder(String(sponsor.sort_order));
    setIsActive(sponsor.is_active);
    setEditId(sponsor.id);
    setShowForm(true);
  }

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
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "png";
      const fileName = `${event.id}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

      const { error } = await supabase.storage
        .from("sponsor-logos")
        .upload(fileName, file, { upsert: true });

      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("sponsor-logos")
        .getPublicUrl(fileName);

      setLogoUrl(urlData.publicUrl);
      toast.success("Logo uploaded");
    } catch (err) {
      console.error("Logo upload error:", err);
      toast.error(
        `Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!name.trim()) return;
    setSaving(true);

    const payload = {
      name,
      tier,
      logo_url: logoUrl || null,
      description: description || null,
      website_url: websiteUrl || null,
      booth_location: boothLocation || null,
      sort_order: parseInt(sortOrder) || 0,
      is_active: isActive,
    };

    const url = editId
      ? `/${eventSlug}/api/admin/sponsors/${editId}`
      : `/${eventSlug}/api/admin/sponsors`;

    const res = await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success(editId ? "Sponsor updated" : "Sponsor added");
      resetForm();
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
    setSaving(false);
  }

  async function deleteSponsor(id: string, sponsorName: string) {
    if (!confirm(`Delete "${sponsorName}"? Any assigned accounts will be unlinked.`)) return;

    const res = await fetch(`/${eventSlug}/api/admin/sponsors/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Sponsor deleted");
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  }

  return (
    <div className="space-y-3">
      {!showForm ? (
        <Button
          onClick={() => setShowForm(true)}
          variant="outline"
          className="w-full"
          size="sm"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Sponsor
        </Button>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {editId ? "Edit Sponsor" : "New Sponsor"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Corp"
                />
              </div>
              <div>
                <Label className="text-xs">Tier *</Label>
                <Select value={tier} onValueChange={(v) => setTier(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.map((t) => (
                      <SelectItem key={t.key} value={t.key}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Logo</Label>
              {logoUrl ? (
                <div className="mt-1.5 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoUrl}
                    alt="Sponsor logo"
                    className="h-16 w-16 rounded border border-white/10 bg-white object-contain p-1"
                  />
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
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
              <p className="mt-1 text-xs text-muted-foreground">
                Max 2MB.
              </p>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Sponsor description..."
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs">Website URL</Label>
              <Input
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Booth Location</Label>
                <Input
                  value={boothLocation}
                  onChange={(e) => setBoothLocation(e.target.value)}
                  placeholder="Booth 42"
                />
              </div>
              <div>
                <Label className="text-xs">Sort Order</Label>
                <Input
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800"
              />
              <Label htmlFor="is_active" className="text-xs font-normal">
                Active (visible to attendees)
              </Label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={saving || !name.trim()}
                size="sm"
              >
                {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {editId ? "Save" : "Add"}
              </Button>
              <Button onClick={resetForm} variant="ghost" size="sm">
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sponsors.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No sponsors yet. Add your first sponsor above.
        </p>
      ) : (
        <div className="space-y-1">
          {sponsors.map((sponsor) => (
            <div
              key={sponsor.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                {sponsor.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sponsor.logo_url}
                    alt={sponsor.name}
                    className="h-8 w-8 shrink-0 rounded border border-white/10 bg-white object-contain p-0.5"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-white/10 bg-white/5 text-xs font-bold text-muted-foreground">
                    {sponsor.name.charAt(0)}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{sponsor.name}</p>
                    <Badge
                      className={`text-[10px] ${getTierColor(tiers, sponsor.tier)}`}
                      variant="secondary"
                    >
                      {tiers.find((t) => t.key === sponsor.tier)?.label ?? sponsor.tier}
                    </Badge>
                    {!sponsor.is_active && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        inactive
                      </Badge>
                    )}
                  </div>
                  {sponsor.booth_location && (
                    <p className="truncate text-xs text-muted-foreground">
                      {sponsor.booth_location}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(sponsor)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteSponsor(sponsor.id, sponsor.name)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// TIERS TAB
// ──────────────────────────────────────────

function TiersTab({ eventSlug }: { eventSlug: string }) {
  const { event } = useEvent();
  const [tiers, setTiers] = useState<SponsorTierConfig[]>(
    event.sponsor_tiers ?? DEFAULT_SPONSOR_TIERS,
  );
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newHasBooth, setNewHasBooth] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editHasBooth, setEditHasBooth] = useState(false);

  function slugify(label: string) {
    return label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  async function saveTiers(updated: SponsorTierConfig[]) {
    setSaving(true);
    try {
      const res = await fetch(`/${eventSlug}/api/admin/sponsor-tiers`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiers: updated }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }
      setTiers(updated);
      toast.success("Tiers updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save tiers");
    } finally {
      setSaving(false);
    }
  }

  function addTier() {
    if (!newLabel.trim()) return;
    const key = slugify(newLabel);
    if (tiers.some((t) => t.key === key)) {
      toast.error(`Tier "${key}" already exists`);
      return;
    }
    const updated = [
      ...tiers,
      {
        key,
        label: newLabel.trim(),
        sort_order: tiers.length,
        has_booth: newHasBooth,
      },
    ];
    saveTiers(updated);
    setNewLabel("");
    setNewHasBooth(false);
    setShowAdd(false);
  }

  function moveTier(idx: number, direction: -1 | 1) {
    const target = idx + direction;
    if (target < 0 || target >= tiers.length) return;
    const updated = [...tiers];
    [updated[idx], updated[target]] = [updated[target], updated[idx]];
    // Re-index sort_order
    const reindexed = updated.map((t, i) => ({ ...t, sort_order: i }));
    saveTiers(reindexed);
  }

  function startEditTier(idx: number) {
    setEditIdx(idx);
    setEditLabel(tiers[idx].label);
    setEditHasBooth(tiers[idx].has_booth);
  }

  function saveEditTier() {
    if (editIdx === null || !editLabel.trim()) return;
    const updated = tiers.map((t, i) =>
      i === editIdx ? { ...t, label: editLabel.trim(), has_booth: editHasBooth } : t,
    );
    saveTiers(updated);
    setEditIdx(null);
  }

  function deleteTier(idx: number) {
    const tier = tiers[idx];
    if (
      !confirm(
        `Delete tier "${tier.label}"? Sponsors using this tier will keep their current tier value but it won't appear in the dropdown.`,
      )
    )
      return;
    const updated = tiers
      .filter((_, i) => i !== idx)
      .map((t, i) => ({ ...t, sort_order: i }));
    saveTiers(updated);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Configure sponsorship tiers for this event. Order determines display priority.
      </p>

      <div className="space-y-1">
        {tiers.map((tier, idx) => (
          <div
            key={tier.key}
            className="flex items-center justify-between rounded-md border px-3 py-2"
          >
            {editIdx === idx ? (
              <div className="flex flex-1 items-center gap-2">
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="h-7 w-40 text-sm"
                  autoFocus
                />
                <div className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={editHasBooth}
                    onChange={(e) => setEditHasBooth(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800"
                  />
                  <span className="text-xs text-muted-foreground">Booth</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={saveEditTier}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setEditIdx(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Badge
                  className={`text-[10px] ${getTierColor(tiers, tier.key)}`}
                  variant="secondary"
                >
                  {tier.label}
                </Badge>
                <span className="text-xs text-muted-foreground">{tier.key}</span>
                {tier.has_booth && (
                  <span className="text-[10px] text-muted-foreground border rounded px-1">
                    booth
                  </span>
                )}
              </div>
            )}

            {editIdx !== idx && (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => moveTier(idx, -1)}
                  disabled={idx === 0 || saving}
                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => moveTier(idx, 1)}
                  disabled={idx === tiers.length - 1 || saving}
                  className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => startEditTier(idx)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteTier(idx)}
                  disabled={saving}
                  className="p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {!showAdd ? (
        <Button
          onClick={() => setShowAdd(true)}
          variant="outline"
          className="w-full"
          size="sm"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add Tier
        </Button>
      ) : (
        <Card>
          <CardContent className="space-y-2 pt-4">
            <div>
              <Label className="text-xs">Label *</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Presenting"
                autoFocus
              />
              {newLabel.trim() && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Key: {slugify(newLabel)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="new_has_booth"
                checked={newHasBooth}
                onChange={(e) => setNewHasBooth(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800"
              />
              <Label htmlFor="new_has_booth" className="text-xs font-normal">
                Has booth (counts toward sponsor passport)
              </Label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={addTier}
                disabled={saving || !newLabel.trim()}
                size="sm"
              >
                {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                Add
              </Button>
              <Button
                onClick={() => {
                  setShowAdd(false);
                  setNewLabel("");
                  setNewHasBooth(false);
                }}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

