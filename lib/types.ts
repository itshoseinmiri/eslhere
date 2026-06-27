// Domain model types — local replacements for the generated `@prisma/client`
// types. The app now runs on an in-memory mock store (see lib/db.ts) instead of
// a real database, so these mirror the shapes the serializers and routes expect.

// ── status enums (stored UPPERCASE, exposed lowercase by lib/serialize.ts) ──
export type ClassStatus = "SCHEDULED" | "COMPLETED" | "CANCELED";
export type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELED";
export type DiscussionStatus = "UPCOMING" | "COMPLETED";
export type RegistrationType = "PRIVATE" | "GROUP" | "DISCUSSION";

// ── records ──
export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  englishLevel: string;
  type: string; // "private" | "group"
  addedAt: Date;
}

export interface Class {
  id: string;
  studentId: string;
  title: string;
  description: string | null;
  date: Date;
  duration: number; // minutes
  status: ClassStatus;
  createdAt: Date;
  student?: Student; // populated when included
}

export interface Payment {
  id: string;
  studentId: string;
  amount: number;
  currency: string;
  note: string | null;
  createdAt: Date;
}

export interface Debt {
  id: string;
  studentId: string;
  amount: number;
  note: string | null;
  settled: boolean;
  createdAt: Date;
}

export interface Booking {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  topic: string;
  notes: string | null;
  date: Date;
  duration: number;
  status: BookingStatus;
  amount: number | null;
  packageSize: number | null;
  createdAt: Date;
}

export interface Availability {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface DiscussionDate {
  id: string;
  discussionId: number;
  date: string;
  time: string;
}

export interface DiscussionReview {
  id: string;
  discussionId: number;
  name: string;
  level: string;
  text: string;
}

export interface Discussion {
  id: number;
  topic: string;
  level: string;
  description: string | null;
  duration: string; // e.g. "60 min"
  status: DiscussionStatus;
  spots: number | null;
  participants: number | null;
  thumbnail: string | null;
  points: string[];
  dates: DiscussionDate[];
  reviews: DiscussionReview[];
}

export interface Registration {
  id: string;
  type: RegistrationType;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  englishLevel: string;
  age: string | null;
  job: string | null;
  whyPrivate: string | null;
  purpose: string | null;
  whyGroup: string | null;
  topics: string | null;
  discussionId: number | null;
  discussionTopic: string | null;
  priorExperience: string | null;
  goals: string | null;
  registeredAt: Date;
}

export interface AdminSession {
  id: string;
  accessToken: string | null;
  expiredAt: Date | null;
}

// Shape accepted by the discussion PATCH route (a subset of fields plus the
// nested dates/reviews replace operations the mock store understands).
export interface DiscussionUpdateInput {
  topic?: string;
  level?: string;
  description?: string;
  duration?: string;
  spots?: number | null;
  participants?: number | null;
  thumbnail?: string | null;
  status?: DiscussionStatus;
  points?: string[];
  dates?: { deleteMany?: object; create: { date: string; time: string }[] };
  reviews?: { deleteMany?: object; create: { name: string; level: string; text: string }[] };
}
