// Database enum types
export type UserRole = "attendee" | "admin" | "staff";
export type EmergencyCategory =
  | "person_safety"
  | "av_problem"
  | "facility_issue"
  | "medical"
  | "other";
export type EmergencySeverity = "low" | "medium" | "high" | "critical";
export type EmergencyStatus =
  | "new"
  | "acknowledged"
  | "in_progress"
  | "resolved";
export type SponsorTier =
  | "platinum"
  | "gold"
  | "silver"
  | "bronze"
  | "community";
export type PollStatus = "draft" | "active" | "closed";
export type FeedbackRating = "red" | "yellow" | "green";
export type SyncStatus = "pending" | "in_progress" | "completed" | "failed";

// Database row types
export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  is_sponsor: boolean;
  sponsor_id: string | null;
  phone: string | null;
  receives_sms_alerts: boolean;
  receives_push_alerts: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  sponsor_profile_id: string;
  attendee_email: string;
  attendee_first_name: string | null;
  attendee_last_name: string | null;
  scanned_at: string;
  notes: string | null;
  updated_at: string;
}

export interface Room {
  id: number;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  title: string;
  category_type: string | null;
  sort_order: number;
  created_at: string;
}

export interface CategoryItem {
  id: number;
  category_id: number;
  name: string;
  sort_order: number;
}

export interface Speaker {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  bio: string | null;
  tag_line: string | null;
  profile_picture: string | null;
  is_top_speaker: boolean;
  links: SpeakerLink[];
  sessionize_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SpeakerLink {
  title: string;
  url: string;
  linkType: string;
}

export interface Session {
  id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  room_id: number | null;
  is_service_session: boolean;
  is_plenum_session: boolean;
  live_url: string | null;
  recording_url: string | null;
  status: string | null;
  sessionize_data: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface SessionWithDetails extends Session {
  room: Room | null;
  speakers: Speaker[];
  categories: CategoryItem[];
}

export interface PersonalScheduleEntry {
  id: string;
  user_id: string;
  session_id: string;
  created_at: string;
}

export interface SessionFeedback {
  id: string;
  user_id: string;
  session_id: string;
  rating: FeedbackRating;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface Movie {
  id: string;
  title: string;
  description: string | null;
  poster_url: string | null;
  trailer_url: string | null;
  genre: string | null;
  runtime_minutes: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MovieVote {
  id: string;
  user_id: string;
  movie_id: string;
  created_at: string;
}

export interface Sponsor {
  id: string;
  name: string;
  tier: SponsorTier;
  logo_url: string | null;
  description: string | null;
  website_url: string | null;
  booth_location: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Poll {
  id: string;
  question: string;
  description: string | null;
  status: PollStatus;
  allow_multiple: boolean;
  created_by: string;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  text: string;
  sort_order: number;
  created_at: string;
}

export interface PollResponse {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export interface EmergencyReport {
  id: string;
  user_id: string | null;
  category: EmergencyCategory;
  severity: EmergencySeverity;
  title: string;
  description: string | null;
  location: string | null;
  status: EmergencyStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  staff_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VenueMap {
  id: string;
  title: string;
  image_url: string;
  floor: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
}

export interface SessionizeSyncLog {
  id: string;
  status: SyncStatus;
  triggered_by: string | null;
  sessions_synced: number;
  speakers_synced: number;
  rooms_synced: number;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent: string | null;
  created_at: string;
}

export type EmergencyMessageStatus = 'unresponded' | 'acknowledged' | 'closed';

export interface EmergencyMessage {
  id: string;
  user_id: string;
  message: string;
  status: EmergencyMessageStatus;
  created_at: string;
  updated_at: string;
}

export interface EmergencyReply {
  id: string;
  message_id: string;
  sender_id: string;
  reply: string;
  is_read: boolean;
  created_at: string;
}

export interface EmergencyReplyWithSender extends EmergencyReply {
  reply_sender?: {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
    role: UserRole;
  };
}

export interface EmergencyMessageWithReplies extends EmergencyMessage {
  replies: EmergencyReplyWithSender[];
  sender?: {
    display_name: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}
