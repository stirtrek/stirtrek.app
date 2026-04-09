// Database enum types
export type UserRole = "attendee" | "admin" | "staff" | "proctor";
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
export type SponsorTier = string;

export interface SponsorTierConfig {
  key: string;
  label: string;
  sort_order: number;
  has_booth: boolean;
}
export type PollStatus = "draft" | "active" | "closed";
export type FeedbackRating = "red" | "yellow" | "green";
export type AnnouncementStatus = "draft" | "scheduled" | "sent";
export type AnnouncementTargetType = "all" | "roles" | "speakers" | "sponsors" | "track";
export interface AnnouncementTargetCriteria {
  roles?: UserRole[];
  category_item_ids?: number[];
}
export type SyncStatus = "pending" | "in_progress" | "completed" | "failed";
export type OrderStatus = "pending" | "completed" | "expired" | "refunded" | "failed";

// ============================================================
// Multi-tenant types
// ============================================================

export interface EventFeatureFlags {
  polls: boolean;
  emergency_reporting: boolean;
  sponsor_leads: boolean;
  announcements: boolean;
  feedback: boolean;
  venue_map: boolean;
  passport: boolean;
  attendance: boolean;
}

export interface Event {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  description: string | null;
  logo_url: string | null;
  event_date: string | null;
  event_end_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_maps_url: string | null;
  timezone: string;
  sessionize_api_id: string | null;
  sponsor_feed_url: string | null;
  sponsor_access_code: string | null;
  feature_flags: EventFeatureFlags;
  sponsor_tiers: SponsorTierConfig[];
  schedule_message: string | null;
  about_content: string | null;
  accent_color: string | null;
  icon_background_color: string | null;
  domain: string | null;
  is_active: boolean;
  show_on_marketing: boolean;
  order_id: string | null;
  stripe_customer_id: string | null;
  max_attendees: number;
  max_admins: number;
  created_at: string;
  updated_at: string;
}

export interface EventMembership {
  id: string;
  event_id: string;
  user_id: string;
  role: UserRole;
  is_sponsor: boolean;
  sponsor_id: string | null;
  joined_at: string;
}

// ============================================================
// Database row types
// ============================================================

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  is_super_admin: boolean;
  phone: string | null;
  receives_sms_alerts: boolean;
  receives_push_alerts: boolean;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  event_id: string;
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
  event_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  event_id: string;
  title: string;
  category_type: string | null;
  sort_order: number;
  created_at: string;
}

export interface CategoryItem {
  id: number;
  event_id: string;
  category_id: number;
  name: string;
  sort_order: number;
}

export interface Speaker {
  id: string;
  event_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  bio: string | null;
  tag_line: string | null;
  profile_picture: string | null;
  photo_override: string | null;
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
  event_id: string;
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
  event_id: string;
  user_id: string;
  session_id: string;
  created_at: string;
}

export interface SessionFeedback {
  id: string;
  event_id: string;
  user_id: string;
  session_id: string;
  rating: FeedbackRating;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sponsor {
  id: string;
  event_id: string;
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
  event_id: string;
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
  event_id: string;
  poll_id: string;
  text: string;
  sort_order: number;
  created_at: string;
}

export interface PollResponse {
  id: string;
  event_id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export interface EmergencyReport {
  id: string;
  event_id: string;
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
  event_id: string;
  title: string;
  image_url: string;
  floor: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AppSetting {
  event_id: string;
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
}

export interface SessionizeSyncLog {
  id: string;
  event_id: string;
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
  event_id: string;
  user_id: string;
  endpoint: string;
  keys: { p256dh: string; auth: string };
  user_agent: string | null;
  created_at: string;
}

export type EmergencyMessageStatus = 'unresponded' | 'acknowledged' | 'closed';

export interface EmergencyMessage {
  id: string;
  event_id: string;
  user_id: string;
  message: string;
  status: EmergencyMessageStatus;
  created_at: string;
  updated_at: string;
}

export interface EmergencyReply {
  id: string;
  event_id: string;
  message_id: string;
  sender_id: string;
  reply: string;
  is_read: boolean;
  created_at: string;
}

export interface Announcement {
  id: string;
  event_id: string;
  message: string;
  status: AnnouncementStatus;
  created_by: string;
  sent_at: string | null;
  scheduled_for: string | null;
  target_type: AnnouncementTargetType;
  target_criteria: AnnouncementTargetCriteria | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  stripe_checkout_session_id: string | null;
  stripe_customer_id: string | null;
  stripe_payment_intent_id: string | null;
  tier_id: string;
  addon_ids: string[];
  amount_cents: number;
  currency: string;
  event_name: string;
  event_slug: string;
  event_date: string | null;
  event_end_date: string | null;
  venue_name: string | null;
  timezone: string;
  status: OrderStatus;
  event_id: string | null;
  created_at: string;
  updated_at: string;
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

// ============================================================
// Attendance (proctor feature)
// ============================================================

export interface SimulcastRoom {
  id: string;
  event_id: string;
  source_room_id: number;
  target_room_id: number;
  created_at: string;
}

export interface AttendanceCount {
  id: string;
  event_id: string;
  room_id: number;
  time_slot: string;
  count: number;
  counted_by: string;
  counted_at: string;
  updated_at: string;
}
