"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useEvent } from "@/providers/event-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Plus,
  Trash2,
  Edit2,
  ArrowLeft,
  ChevronDown,
  Upload,
  X,
} from "lucide-react";
import type { SessionizeSyncLog, Speaker, Room } from "@/lib/types";
import { toast } from "sonner";
import Link from "next/link";
import { formatTime, eventLocalToUTC, utcToEventLocal } from "@/lib/utils";

type Tab = "sessions" | "speakers" | "rooms";

interface SessionEntry {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  room_id: number | null;
  is_service_session: boolean;
  speaker_ids: string[];
}

export default function AdminSchedulePage() {
  const { event, eventSlug, eventPath } = useEvent();
  const isSessionize = !!event.sessionize_api_id;

  if (isSessionize) {
    return <SessionizeSyncView eventSlug={eventSlug} eventPath={eventPath} />;
  }

  return <ManualEntryView eventSlug={eventSlug} eventPath={eventPath} />;
}

// ──────────────────────────────────────────
// SESSIONIZE SYNC VIEW (existing functionality)
// ──────────────────────────────────────────

function SessionizeSyncView({
  eventSlug,
  eventPath,
}: {
  eventSlug: string;
  eventPath: (p: string) => string;
}) {
  const { event } = useEvent();
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<SessionizeSyncLog[]>([]);
  const supabase = createClient();

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("sessionize_sync_log")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(10);
    if (data) setSyncLogs(data);
  }, [supabase]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch(`/${eventSlug}/api/sessionize/sync`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setSyncResult(`Error: ${data.error}`);
      } else {
        setSyncResult(
          `Synced ${data.sessions} sessions, ${data.speakers} speakers, ${data.rooms} rooms, ${data.categories} categories`,
        );
      }
    } catch {
      setSyncResult("Network error during sync");
    } finally {
      setSyncing(false);
      fetchLogs();
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "in_progress":
        return <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href={eventPath("/admin")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Schedule Sync</h1>
      </div>

      <Button onClick={handleSync} disabled={syncing} className="w-full">
        {syncing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Syncing...
          </>
        ) : (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Now
          </>
        )}
      </Button>

      {syncResult && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm">{syncResult}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Sync History</CardTitle>
        </CardHeader>
        <CardContent>
          {syncLogs.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No syncs yet. Click &quot;Sync Now&quot; to pull data from
              Sessionize.
            </p>
          ) : (
            <div className="space-y-3">
              {syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-md border p-3"
                >
                  <div className="mt-0.5">{statusIcon(log.status)}</div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          log.status === "completed"
                            ? "default"
                            : log.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {log.status}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {new Date(log.started_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                          timeZone: event.timezone,
                        })}
                      </span>
                    </div>
                    {log.status === "completed" && (
                      <p className="text-muted-foreground text-xs">
                        {log.sessions_synced} sessions, {log.speakers_synced}{" "}
                        speakers, {log.rooms_synced} rooms
                      </p>
                    )}
                    {log.error_message && (
                      <p className="text-destructive text-xs">
                        {log.error_message}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ──────────────────────────────────────────
// MANUAL ENTRY VIEW
// ──────────────────────────────────────────

function ManualEntryView({
  eventSlug,
  eventPath,
}: {
  eventSlug: string;
  eventPath: (p: string) => string;
}) {
  const [tab, setTab] = useState<Tab>("sessions");
  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    const [sessRes, spkRes, rmRes] = await Promise.all([
      fetch(`/${eventSlug}/api/admin/sessions`),
      fetch(`/${eventSlug}/api/admin/speakers`),
      fetch(`/${eventSlug}/api/admin/rooms`),
    ]);

    if (sessRes.ok) {
      const d = await sessRes.json();
      setSessions(d.sessions);
    }
    if (spkRes.ok) {
      const d = await spkRes.json();
      setSpeakers(d.speakers);
    }
    if (rmRes.ok) {
      const d = await rmRes.json();
      setRooms(d.rooms);
    }
    setLoading(false);
  }, [eventSlug]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "sessions", label: "Sessions", count: sessions.length },
    { key: "speakers", label: "Speakers", count: speakers.length },
    { key: "rooms", label: "Rooms", count: rooms.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href={eventPath("/admin")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Schedule</h1>
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
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          {tab === "sessions" && (
            <SessionsTab
              sessions={sessions}
              speakers={speakers}
              rooms={rooms}
              eventSlug={eventSlug}
              onRefresh={fetchAll}
            />
          )}
          {tab === "speakers" && (
            <SpeakersTab
              speakers={speakers}
              eventSlug={eventSlug}
              onRefresh={fetchAll}
            />
          )}
          {tab === "rooms" && (
            <RoomsTab
              rooms={rooms}
              eventSlug={eventSlug}
              onRefresh={fetchAll}
            />
          )}
        </>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// ROOMS TAB
// ──────────────────────────────────────────

function RoomsTab({
  rooms,
  eventSlug,
  onRefresh,
}: {
  rooms: Room[];
  eventSlug: string;
  onRefresh: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  async function addRoom() {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await fetch(`/${eventSlug}/api/admin/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      setNewName("");
      toast.success("Room added");
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
    setSaving(false);
  }

  async function renameRoom(id: number) {
    if (!editName.trim()) return;
    const res = await fetch(`/${eventSlug}/api/admin/rooms/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (res.ok) {
      toast.success("Room renamed");
      setEditingId(null);
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  }

  async function deleteRoom(id: number) {
    const res = await fetch(`/${eventSlug}/api/admin/rooms/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Room deleted");
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Room name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addRoom()}
        />
        <Button onClick={addRoom} disabled={saving || !newName.trim()} size="sm">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {rooms.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No rooms yet. Add rooms before creating sessions.
        </p>
      ) : (
        <div className="space-y-1">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              {editingId === room.id ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") renameRoom(room.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  autoFocus
                  className="mr-2 h-7 text-sm"
                />
              ) : (
                <span className="text-sm">{room.name}</span>
              )}
              <div className="flex gap-1">
                {editingId === room.id ? (
                  <>
                    <Button
                      onClick={() => renameRoom(room.id)}
                      disabled={!editName.trim()}
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                    >
                      Save
                    </Button>
                    <Button
                      onClick={() => setEditingId(null)}
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(room.id);
                        setEditName(room.name);
                      }}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteRoom(room.id)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// SPEAKERS TAB
// ──────────────────────────────────────────

function SpeakersTab({
  speakers,
  eventSlug,
  onRefresh,
}: {
  speakers: Speaker[];
  eventSlug: string;
  onRefresh: () => void;
}) {
  const { event } = useEvent();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [pictureUrl, setPictureUrl] = useState("");
  const [photoOverride, setPhotoOverride] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setFirstName("");
    setLastName("");
    setBio("");
    setTagLine("");
    setPictureUrl("");
    setPhotoOverride("");
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(speaker: Speaker) {
    setFirstName(speaker.first_name);
    setLastName(speaker.last_name);
    setBio(speaker.bio ?? "");
    setTagLine(speaker.tag_line ?? "");
    setPictureUrl(speaker.profile_picture ?? "");
    setPhotoOverride(speaker.photo_override ?? "");
    setEditId(speaker.id);
    setShowForm(true);
  }

  async function handlePhotoUpload(file: File) {
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
      const fileName = `${event.id}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("speaker-photos")
        .upload(fileName, file, { upsert: true });

      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("speaker-photos")
        .getPublicUrl(fileName);

      setPhotoOverride(urlData.publicUrl);
      toast.success("Photo uploaded");
    } catch (err) {
      console.error("Photo upload error:", err);
      toast.error(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);

    const payload = {
      first_name: firstName,
      last_name: lastName,
      bio: bio || null,
      tag_line: tagLine || null,
      profile_picture: pictureUrl || null,
      photo_override: photoOverride || null,
    };

    const url = editId
      ? `/${eventSlug}/api/admin/speakers/${editId}`
      : `/${eventSlug}/api/admin/speakers`;

    const res = await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success(editId ? "Speaker updated" : "Speaker added");
      resetForm();
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
    setSaving(false);
  }

  async function deleteSpeaker(id: string) {
    const res = await fetch(`/${eventSlug}/api/admin/speakers/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Speaker deleted");
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  }

  const previewPhoto = photoOverride || pictureUrl;

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
          Add Speaker
        </Button>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {editId ? "Edit Speaker" : "New Speaker"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">First Name *</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                />
              </div>
              <div>
                <Label className="text-xs">Last Name *</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Tagline</Label>
              <Input
                value={tagLine}
                onChange={(e) => setTagLine(e.target.value)}
                placeholder="Software Engineer at Acme"
              />
            </div>
            <div>
              <Label className="text-xs">Bio</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Speaker bio..."
                rows={3}
              />
            </div>
            <div>
              <Label className="text-xs">Photo</Label>
              {previewPhoto ? (
                <div className="mt-1.5 flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewPhoto}
                    alt="Speaker photo"
                    className="h-16 w-16 rounded-full border border-white/10 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoOverride("");
                      setPictureUrl("");
                    }}
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
                      if (file) handlePhotoUpload(file);
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
                    {uploading ? "Uploading..." : "Upload photo"}
                  </button>
                </div>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                Max 2MB. Or enter a URL below.
              </p>
            </div>
            <div>
              <Label className="text-xs">Photo URL (fallback)</Label>
              <Input
                value={pictureUrl}
                onChange={(e) => setPictureUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={saving || !firstName.trim() || !lastName.trim()}
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

      {speakers.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No speakers yet.
        </p>
      ) : (
        <div className="space-y-1">
          {speakers.map((speaker) => (
            <div
              key={speaker.id}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {speaker.full_name}
                </p>
                {speaker.tag_line && (
                  <p className="text-muted-foreground truncate text-xs">
                    {speaker.tag_line}
                  </p>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(speaker)}
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => deleteSpeaker(speaker.id)}
                  className="text-muted-foreground hover:text-destructive p-1"
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
// SESSIONS TAB
// ──────────────────────────────────────────

function SessionsTab({
  sessions,
  speakers,
  rooms,
  eventSlug,
  onRefresh,
}: {
  sessions: SessionEntry[];
  speakers: Speaker[];
  rooms: Room[];
  eventSlug: string;
  onRefresh: () => void;
}) {
  const { event } = useEvent();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [roomId, setRoomId] = useState<string>("");
  const [selectedSpeakers, setSelectedSpeakers] = useState<string[]>([]);
  const [isService, setIsService] = useState(false);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setTitle("");
    setDescription("");
    setStartsAt("");
    setEndsAt("");
    setRoomId("");
    setSelectedSpeakers([]);
    setIsService(false);
    setEditId(null);
    setShowForm(false);
  }

  function startEdit(session: SessionEntry) {
    setTitle(session.title);
    setDescription(session.description ?? "");
    setStartsAt(session.starts_at ? toLocalInput(session.starts_at, event.timezone) : "");
    setEndsAt(session.ends_at ? toLocalInput(session.ends_at, event.timezone) : "");
    setRoomId(session.room_id?.toString() ?? "");
    setSelectedSpeakers(session.speaker_ids);
    setIsService(session.is_service_session);
    setEditId(session.id);
    setShowForm(true);
  }

  async function handleSubmit() {
    if (!title.trim()) return;
    setSaving(true);

    const payload = {
      title,
      description: description || null,
      starts_at: startsAt ? eventLocalToUTC(startsAt, event.timezone) : null,
      ends_at: endsAt ? eventLocalToUTC(endsAt, event.timezone) : null,
      room_id: roomId ? Number(roomId) : null,
      speaker_ids: selectedSpeakers,
      is_service_session: isService,
    };

    const url = editId
      ? `/${eventSlug}/api/admin/sessions/${editId}`
      : `/${eventSlug}/api/admin/sessions`;

    const res = await fetch(url, {
      method: editId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      toast.success(editId ? "Session updated" : "Session added");
      resetForm();
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
    setSaving(false);
  }

  async function deleteSession(id: string) {
    const res = await fetch(`/${eventSlug}/api/admin/sessions/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success("Session deleted");
      onRefresh();
    } else {
      const err = await res.json();
      toast.error(err.error);
    }
  }

  function toggleSpeaker(id: string) {
    setSelectedSpeakers((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  }

  function roomName(id: number | null) {
    if (!id) return null;
    return rooms.find((r) => r.id === id)?.name ?? null;
  }

  function speakerNames(ids: string[]) {
    return ids
      .map((id) => speakers.find((s) => s.id === id)?.full_name)
      .filter(Boolean)
      .join(", ");
  }

  return (
    <div className="space-y-3">
      <Button
        onClick={() => { setEditId(null); setShowForm(true); }}
        variant="outline"
        className="w-full"
        size="sm"
      >
        <Plus className="mr-1 h-4 w-4" />
        Add Session
      </Button>

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editId ? "Edit Session" : "New Session"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Session title"
                className="text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Session description..."
                rows={3}
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Start Time</Label>
                <Input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">End Time</Label>
                <Input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Room</Label>
              <div className="relative">
                <select
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  className="border-input bg-background w-full appearance-none rounded-md border px-3 py-2 pr-8 text-sm"
                >
                  <option value="">No room</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="text-muted-foreground pointer-events-none absolute right-2 top-2.5 h-4 w-4" />
              </div>
            </div>
            {speakers.length > 0 && (
              <div>
                <Label className="text-xs">Speakers</Label>
                <div className="mt-1 max-h-32 space-y-1 overflow-y-auto rounded-md border p-2">
                  {speakers.map((speaker) => (
                    <label
                      key={speaker.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSpeakers.includes(speaker.id)}
                        onChange={() => toggleSpeaker(speaker.id)}
                        className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800"
                      />
                      {speaker.full_name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_service"
                checked={isService}
                onChange={(e) => setIsService(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800"
              />
              <Label htmlFor="is_service" className="text-xs font-normal">
                Service session (lunch, break, etc.)
              </Label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={saving || !title.trim()}
                size="sm"
              >
                {saving && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                {editId ? "Save" : "Add"}
              </Button>
              <Button onClick={resetForm} variant="ghost" size="sm">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {sessions.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No sessions yet. Add rooms and speakers first, then create sessions.
        </p>
      ) : (
        <div className="space-y-1">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="rounded-md border px-3 py-2"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {session.title}
                  </p>
                  <div className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 text-xs">
                    {session.starts_at && (
                      <span>
                        {formatTime(session.starts_at, event.timezone)}
                        {session.ends_at && (
                          <>
                            {" - "}
                            {formatTime(session.ends_at, event.timezone)}
                          </>
                        )}
                      </span>
                    )}
                    {roomName(session.room_id) && (
                      <span>{roomName(session.room_id)}</span>
                    )}
                  </div>
                  {session.speaker_ids.length > 0 && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {speakerNames(session.speaker_ids)}
                    </p>
                  )}
                </div>
                <div className="ml-2 flex gap-1">
                  {session.is_service_session && (
                    <Badge variant="secondary" className="text-[10px]">
                      Service
                    </Badge>
                  )}
                  <button
                    onClick={() => startEdit(session)}
                    className="text-muted-foreground hover:text-foreground p-1"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper: convert UTC ISO string to datetime-local input format in event timezone
function toLocalInput(iso: string, timezone: string): string {
  return utcToEventLocal(iso, timezone);
}
