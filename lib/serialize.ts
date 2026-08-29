// Maps stored rows to the legacy JSON response shapes the frontend expects
// (lowercase status strings, inline dates/reviews/points arrays, etc.) so the
// storage layer can change without touching any client code.
import type {
  Student,
  Class,
  Booking,
  Payment,
  Debt,
  Discussion,
  DiscussionDate,
  DiscussionModule,
  DiscussionReview,
  Registration,
  TeacherReview,
  ClassStatus,
  BookingStatus,
  DiscussionStatus,
  RegistrationType,
  ReviewStatus,
} from "@/lib/types";

// ── status <-> string ──
export function jsonToClassStatus(s: string): ClassStatus {
  return s.toUpperCase() as ClassStatus;
}
export function jsonToBookingStatus(s: string): BookingStatus {
  return s.toUpperCase() as BookingStatus;
}
export function jsonToDiscussionStatus(s: string): DiscussionStatus {
  return s.toUpperCase() as DiscussionStatus;
}
export function jsonToRegistrationType(s: string): RegistrationType {
  return s.toUpperCase() as RegistrationType;
}
export function jsonToReviewStatus(s: string): ReviewStatus {
  return s.toUpperCase() as ReviewStatus;
}

// ── Student ──
export function serializeStudent(s: Student) {
  return {
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    email: s.email,
    phone: s.phone,
    englishLevel: s.englishLevel,
    type: s.type,
    addedAt: s.addedAt.toISOString(),
  };
}

// ── Class / Session ──
export function serializeClass(c: Class) {
  return {
    id: c.id,
    studentId: c.studentId,
    title: c.title,
    ...(c.description ? { description: c.description } : {}),
    date: c.date.toISOString(),
    duration: c.duration,
    status: c.status.toLowerCase(),
  };
}

// ── Booking ──
export function serializeBooking(b: Booking) {
  return {
    id: b.id,
    name: b.name,
    email: b.email,
    ...(b.phone ? { phone: b.phone } : {}),
    topic: b.topic,
    ...(b.notes ? { notes: b.notes } : {}),
    date: b.date.toISOString(),
    duration: b.duration,
    status: b.status.toLowerCase(),
    ...(b.amount != null ? { amount: b.amount } : {}),
    ...(b.packageSize != null ? { packageSize: b.packageSize } : {}),
    createdAt: b.createdAt.toISOString(),
  };
}

// ── Payment ──
export function serializePayment(p: Payment) {
  return {
    id: p.id,
    studentId: p.studentId,
    amount: p.amount,
    currency: p.currency,
    ...(p.note ? { note: p.note } : {}),
    createdAt: p.createdAt.toISOString(),
  };
}

// ── Debt ──
export function serializeDebt(d: Debt) {
  return {
    id: d.id,
    studentId: d.studentId,
    amount: d.amount,
    ...(d.note ? { note: d.note } : {}),
    settled: d.settled,
    createdAt: d.createdAt.toISOString(),
  };
}

// ── Discussion (+ nested dates / reviews / curriculum) ──
type DiscussionWithRelations = Discussion & {
  dates: DiscussionDate[];
  reviews: DiscussionReview[];
  curriculum: DiscussionModule[];
};

export function serializeDiscussion(d: DiscussionWithRelations) {
  return {
    id: d.id,
    topic: d.topic,
    level: d.level,
    description: d.description ?? "",
    duration: d.duration,
    status: d.status.toLowerCase(),
    ...(d.spots != null ? { spots: d.spots } : {}),
    ...(d.participants != null ? { participants: d.participants } : {}),
    ...(d.thumbnail ? { thumbnail: d.thumbnail } : {}),
    ...(d.points.length ? { points: d.points } : {}),
    ...(d.learn.length ? { learn: d.learn } : {}),
    ...(d.requirements.length ? { requirements: d.requirements } : {}),
    ...(d.curriculum.length
      ? {
          curriculum: d.curriculum.map((m) => ({
            title: m.title,
            ...(m.summary ? { summary: m.summary } : {}),
            ...(m.items.length ? { items: m.items } : {}),
          })),
        }
      : {}),
    dates: d.dates.map((x) => ({
      date: x.date,
      ...(x.time ? { time: x.time } : {}),
    })),
    ...(d.reviews.length
      ? {
          reviews: d.reviews.map((r) => ({
            name: r.name,
            ...(r.level ? { level: r.level } : {}),
            text: r.text,
          })),
        }
      : {}),
  };
}

// ── Teacher review (public testimonial) ──
export function serializeTeacherReview(r: TeacherReview) {
  return {
    id: r.id,
    name: r.name,
    level: r.level,
    rating: r.rating,
    text: r.text,
    status: r.status.toLowerCase(),
    createdAt: r.createdAt.toISOString(),
  };
}

// ── Registration (lead) ──
// Mirrors the original denormalized shape: lowercase `type` and only the
// fields that were actually captured for that registration type.
export function serializeRegistration(r: Registration) {
  return {
    type: r.type.toLowerCase(),
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    phone: r.phone,
    englishLevel: r.englishLevel,
    ...(r.age != null ? { age: r.age } : {}),
    ...(r.job != null ? { job: r.job } : {}),
    ...(r.whyPrivate != null ? { whyPrivate: r.whyPrivate } : {}),
    ...(r.purpose != null ? { purpose: r.purpose } : {}),
    ...(r.whyGroup != null ? { whyGroup: r.whyGroup } : {}),
    ...(r.topics != null ? { topics: r.topics } : {}),
    ...(r.discussionId != null ? { discussionId: r.discussionId } : {}),
    ...(r.discussionTopic != null ? { discussionTopic: r.discussionTopic } : {}),
    ...(r.priorExperience != null ? { priorExperience: r.priorExperience } : {}),
    ...(r.goals != null ? { goals: r.goals } : {}),
    registeredAt: r.registeredAt.toISOString(),
  };
}
