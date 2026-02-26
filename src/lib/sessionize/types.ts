// Sessionize API response types for /view/All endpoint

export interface SessionizeResponse {
  sessions: SessionizeSession[];
  speakers: SessionizeSpeaker[];
  questions: SessionizeQuestion[];
  categories: SessionizeCategory[];
  rooms: SessionizeRoom[];
}

export interface SessionizeSession {
  id: string;
  title: string;
  description: string | null;
  startsAt: string | null;
  endsAt: string | null;
  isServiceSession: boolean;
  isPlenumSession: boolean;
  speakers: string[]; // Speaker UUIDs
  categoryItems: number[]; // Category item IDs
  questionAnswers: unknown[];
  roomId: number | null;
  liveUrl: string | null;
  recordingUrl: string | null;
  status: string | null;
  isInformed: boolean;
  isConfirmed: boolean;
}

export interface SessionizeSpeaker {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  bio: string | null;
  tagLine: string | null;
  profilePicture: string | null;
  isTopSpeaker: boolean;
  links: SessionizeLink[];
  sessions: number[]; // Session IDs (numeric)
  categoryItems: number[];
  questionAnswers: unknown[];
}

export interface SessionizeLink {
  title: string;
  url: string;
  linkType: string;
}

export interface SessionizeCategory {
  id: number;
  title: string;
  items: SessionizeCategoryItem[];
  sort: number;
  type: string; // "session" or "speaker"
}

export interface SessionizeCategoryItem {
  id: number;
  name: string;
  sort: number;
}

export interface SessionizeRoom {
  id: number;
  name: string;
  sort: number;
}

export interface SessionizeQuestion {
  id: number;
  question: string;
  questionType: string;
  sort: number;
}
