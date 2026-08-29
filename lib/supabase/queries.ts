// Supabase-backed data access for the "active students" and "manage discussions"
// admin features. Runs through the service-role client (bypasses RLS — auth is
// enforced upstream by verifyToken in the route handlers).
//
// The DB is snake_case; the app is camelCase. Selects use PostgREST column
// aliases (`camel:snake`) to return camelCase directly; date columns come back as
// ISO strings and are mapped to Date here so the existing lib/serialize.ts
// serializers keep working unchanged.
import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  Student,
  Class,
  Payment,
  Debt,
  Discussion,
  DiscussionDate,
  DiscussionReview,
  DiscussionStatus,
  Registration,
  RegistrationType,
  TeacherReview,
  ReviewStatus,
} from "@/lib/types";

// ── aliased column lists ──
const STUDENT_COLS =
  "id, firstName:first_name, lastName:last_name, email, phone, englishLevel:english_level, type, addedAt:added_at";
const CLASS_COLS =
  "id, studentId:student_id, title, description, date, duration, status, createdAt:created_at";
const PAYMENT_COLS =
  "id, studentId:student_id, amount, currency, note, createdAt:created_at";
const DEBT_COLS =
  "id, studentId:student_id, amount, note, settled, createdAt:created_at";
const DISCUSSION_COLS = `id, topic, level, description, duration, status, spots, participants, thumbnail, points,
  dates:discussion_dates(id, date, time),
  reviews:discussion_reviews(id, name, level, text)`;
const REGISTRATION_COLS =
  "id, type, firstName:first_name, lastName:last_name, email, phone, englishLevel:english_level, age, job, whyPrivate:why_private, purpose, whyGroup:why_group, topics, discussionId:discussion_id, discussionTopic:discussion_topic, priorExperience:prior_experience, goals, registeredAt:registered_at";

// ── row shapes (as returned by the aliased selects above) ──
interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  englishLevel: string;
  type: string;
  addedAt: string;
}
interface ClassRow {
  id: string;
  studentId: string;
  title: string;
  description: string | null;
  date: string;
  duration: number;
  status: string;
  createdAt: string;
}
interface PaymentRow {
  id: string;
  studentId: string;
  amount: number;
  currency: string;
  note: string | null;
  createdAt: string;
}
interface DebtRow {
  id: string;
  studentId: string;
  amount: number;
  note: string | null;
  settled: boolean;
  createdAt: string;
}
interface DiscussionDateRow {
  id: number;
  date: string;
  time: string;
}
interface DiscussionReviewRow {
  id: number;
  name: string;
  level: string;
  text: string;
}
interface DiscussionRow {
  id: number;
  topic: string;
  level: string;
  description: string | null;
  duration: string;
  status: string;
  spots: number | null;
  participants: number | null;
  thumbnail: string | null;
  points: string[] | null;
  dates: DiscussionDateRow[] | null;
  reviews: DiscussionReviewRow[] | null;
}

export type DiscussionFull = Discussion & {
  dates: DiscussionDate[];
  reviews: DiscussionReview[];
};

// ── row -> domain mappers ──
function toStudent(r: StudentRow): Student {
  return { ...r, addedAt: new Date(r.addedAt) };
}
function toClass(r: ClassRow): Class {
  return {
    ...r,
    status: r.status as Class["status"],
    date: new Date(r.date),
    createdAt: new Date(r.createdAt),
  };
}
function toPayment(r: PaymentRow): Payment {
  return { ...r, createdAt: new Date(r.createdAt) };
}
function toDebt(r: DebtRow): Debt {
  return { ...r, createdAt: new Date(r.createdAt) };
}
function toDiscussion(r: DiscussionRow): DiscussionFull {
  const dates = (r.dates ?? [])
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((d): DiscussionDate => ({ id: String(d.id), discussionId: r.id, date: d.date, time: d.time }));
  const reviews = (r.reviews ?? [])
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((rv): DiscussionReview => ({ id: String(rv.id), discussionId: r.id, name: rv.name, level: rv.level, text: rv.text }));
  return {
    id: r.id,
    topic: r.topic,
    level: r.level,
    description: r.description,
    duration: r.duration,
    status: r.status as DiscussionStatus,
    spots: r.spots,
    participants: r.participants,
    thumbnail: r.thumbnail,
    points: r.points ?? [],
    dates,
    reviews,
  };
}

// ═══ students ═══
export async function listStudents(): Promise<Student[]> {
  const { data, error } = await supabaseAdmin()
    .from("students")
    .select(STUDENT_COLS)
    .order("added_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as StudentRow[]).map(toStudent);
}

export interface StudentInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  englishLevel: string;
  type: string;
}
export async function createStudent(input: StudentInput): Promise<Student> {
  const { data, error } = await supabaseAdmin()
    .from("students")
    .insert({
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      english_level: input.englishLevel,
      type: input.type,
    })
    .select(STUDENT_COLS)
    .single();
  if (error) throw error;
  return toStudent(data as unknown as StudentRow);
}

export async function getStudentById(id: string): Promise<Student | null> {
  const { data, error } = await supabaseAdmin()
    .from("students")
    .select(STUDENT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toStudent(data as unknown as StudentRow) : null;
}

export async function deleteStudent(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("students").delete().eq("id", id);
  if (error) throw error;
}

// classes / payments / debts for a student's profile
export async function getStudentRelations(studentId: string): Promise<{
  classes: Class[];
  payments: Payment[];
  debts: Debt[];
}> {
  const admin = supabaseAdmin();
  const [cls, pay, debt] = await Promise.all([
    admin.from("classes").select(CLASS_COLS).eq("student_id", studentId),
    admin.from("payments").select(PAYMENT_COLS).eq("student_id", studentId),
    admin.from("debts").select(DEBT_COLS).eq("student_id", studentId),
  ]);
  if (cls.error) throw cls.error;
  if (pay.error) throw pay.error;
  if (debt.error) throw debt.error;
  return {
    classes: ((cls.data ?? []) as unknown as ClassRow[]).map(toClass),
    payments: ((pay.data ?? []) as unknown as PaymentRow[]).map(toPayment),
    debts: ((debt.data ?? []) as unknown as DebtRow[]).map(toDebt),
  };
}

// ═══ discussions ═══
export async function listDiscussions(): Promise<DiscussionFull[]> {
  const { data, error } = await supabaseAdmin()
    .from("discussions")
    .select(DISCUSSION_COLS)
    .order("id", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as DiscussionRow[]).map(toDiscussion);
}

export async function getDiscussion(id: number): Promise<DiscussionFull | null> {
  const { data, error } = await supabaseAdmin()
    .from("discussions")
    .select(DISCUSSION_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toDiscussion(data as unknown as DiscussionRow) : null;
}

export async function discussionExists(id: number): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("discussions")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

interface DateEntry {
  date: string;
  time: string;
}
interface ReviewEntry {
  name: string;
  level: string;
  text: string;
}

async function insertChildren(id: number, dates: DateEntry[], reviews: ReviewEntry[]): Promise<void> {
  const admin = supabaseAdmin();
  if (dates.length) {
    const { error } = await admin
      .from("discussion_dates")
      .insert(dates.map((d) => ({ discussion_id: id, date: d.date, time: d.time })));
    if (error) throw error;
  }
  if (reviews.length) {
    const { error } = await admin
      .from("discussion_reviews")
      .insert(reviews.map((r) => ({ discussion_id: id, name: r.name, level: r.level, text: r.text })));
    if (error) throw error;
  }
}

export interface DiscussionInput {
  topic: string;
  level: string;
  description: string;
  duration: string;
  status: DiscussionStatus;
  spots: number | null;
  participants: number | null;
  thumbnail: string | null;
  points: string[];
  dates: DateEntry[];
  reviews: ReviewEntry[];
}

export async function createDiscussion(input: DiscussionInput): Promise<DiscussionFull> {
  const { data, error } = await supabaseAdmin()
    .from("discussions")
    .insert({
      topic: input.topic,
      level: input.level,
      description: input.description,
      duration: input.duration,
      status: input.status,
      spots: input.spots,
      participants: input.participants,
      thumbnail: input.thumbnail,
      points: input.points,
    })
    .select("id")
    .single();
  if (error) throw error;
  const id = (data as { id: number }).id;
  await insertChildren(id, input.dates, input.reviews);
  const created = await getDiscussion(id);
  if (!created) throw new Error("Created discussion could not be reloaded");
  return created;
}

// Partial update. `dates`/`reviews` are "replace if present" — undefined leaves
// them untouched; an array (even empty) clears and re-inserts.
export interface DiscussionPatch {
  topic?: string;
  level?: string;
  description?: string;
  duration?: string;
  status?: DiscussionStatus;
  spots?: number | null;
  participants?: number | null;
  thumbnail?: string | null;
  points?: string[];
  dates?: DateEntry[];
  reviews?: ReviewEntry[];
}

export async function updateDiscussion(id: number, patch: DiscussionPatch): Promise<DiscussionFull> {
  const admin = supabaseAdmin();

  const scalar: Record<string, unknown> = {};
  if (patch.topic !== undefined) scalar.topic = patch.topic;
  if (patch.level !== undefined) scalar.level = patch.level;
  if (patch.description !== undefined) scalar.description = patch.description;
  if (patch.duration !== undefined) scalar.duration = patch.duration;
  if (patch.status !== undefined) scalar.status = patch.status;
  if (patch.spots !== undefined) scalar.spots = patch.spots;
  if (patch.participants !== undefined) scalar.participants = patch.participants;
  if (patch.thumbnail !== undefined) scalar.thumbnail = patch.thumbnail;
  if (patch.points !== undefined) scalar.points = patch.points;
  if (Object.keys(scalar).length) {
    const { error } = await admin.from("discussions").update(scalar).eq("id", id);
    if (error) throw error;
  }

  if (patch.dates !== undefined) {
    const del = await admin.from("discussion_dates").delete().eq("discussion_id", id);
    if (del.error) throw del.error;
    await insertChildren(id, patch.dates, []);
  }
  if (patch.reviews !== undefined) {
    const del = await admin.from("discussion_reviews").delete().eq("discussion_id", id);
    if (del.error) throw del.error;
    await insertChildren(id, [], patch.reviews);
  }

  const updated = await getDiscussion(id);
  if (!updated) throw new Error("Updated discussion could not be reloaded");
  return updated;
}

export async function deleteDiscussion(id: number): Promise<void> {
  // FK cascade removes dates/reviews.
  const { error } = await supabaseAdmin().from("discussions").delete().eq("id", id);
  if (error) throw error;
}

// ═══ auth users (admin login accounts) ═══
export interface AuthUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  confirmed: boolean;
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  const { data, error } = await supabaseAdmin().auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return data.users.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    confirmed: Boolean(u.email_confirmed_at),
  }));
}

// ═══ registrations (leads) ═══
interface RegistrationRow {
  id: string;
  type: string;
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
  registeredAt: string;
}

function toRegistration(r: RegistrationRow): Registration {
  return { ...r, type: r.type as RegistrationType, registeredAt: new Date(r.registeredAt) };
}

export async function listRegistrations(): Promise<Registration[]> {
  const { data, error } = await supabaseAdmin()
    .from("registrations")
    .select(REGISTRATION_COLS)
    .order("registered_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as unknown as RegistrationRow[]).map(toRegistration);
}

export interface RegistrationInput {
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
}

export async function createRegistration(input: RegistrationInput): Promise<void> {
  const { error } = await supabaseAdmin().from("registrations").insert({
    type: input.type,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email,
    phone: input.phone,
    english_level: input.englishLevel,
    age: input.age,
    job: input.job,
    why_private: input.whyPrivate,
    purpose: input.purpose,
    why_group: input.whyGroup,
    topics: input.topics,
    discussion_id: input.discussionId,
    discussion_topic: input.discussionTopic,
    prior_experience: input.priorExperience,
    goals: input.goals,
  });
  if (error) throw error;
}

// ═══ teacher reviews (public testimonials) ═══
const TEACHER_REVIEW_COLS =
  "id, name, level, rating, text, status, createdAt:created_at";

interface TeacherReviewRow {
  id: string;
  name: string;
  level: string;
  rating: number;
  text: string;
  status: string;
  createdAt: string;
}

function toTeacherReview(r: TeacherReviewRow): TeacherReview {
  return {
    ...r,
    status: r.status.toUpperCase() as ReviewStatus,
    createdAt: new Date(r.createdAt),
  };
}

export interface TeacherReviewInput {
  name: string;
  level: string;
  rating: number;
  text: string;
}

export async function createTeacherReview(input: TeacherReviewInput): Promise<void> {
  const { error } = await supabaseAdmin().from("teacher_reviews").insert({
    name: input.name,
    level: input.level,
    rating: input.rating,
    text: input.text,
    // status defaults to 'PENDING' — awaits admin approval.
  });
  if (error) throw error;
}

// All reviews, newest first. Optionally filter by status. Admin use.
export async function listTeacherReviews(status?: ReviewStatus): Promise<TeacherReview[]> {
  let query = supabaseAdmin()
    .from("teacher_reviews")
    .select(TEACHER_REVIEW_COLS)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as unknown as TeacherReviewRow[]).map(toTeacherReview);
}

// Approved reviews only, newest first. Public (homepage) use.
export async function listApprovedReviews(): Promise<TeacherReview[]> {
  return listTeacherReviews("APPROVED");
}

export async function setReviewStatus(id: string, status: ReviewStatus): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("teacher_reviews")
    .update({ status })
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

export async function deleteTeacherReview(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("teacher_reviews")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}
