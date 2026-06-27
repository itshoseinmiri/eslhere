// ─────────────────────────────────────────────────────────────────────────────
// TEMPORARY in-memory mock data store — stands in for Prisma/Postgres "for now"
// so the app can run and deploy without a database. It implements just the slice
// of the Prisma Client API the routes use (findMany / findUnique / create /
// createMany / update / delete / upsert with where / orderBy / include / take).
//
// Data is seeded below and lives in module memory: writes work within a running
// process but are NOT persisted across deployments or serverless isolates.
// Swap this file back for a real Prisma client when reintroducing a database.
// ─────────────────────────────────────────────────────────────────────────────
import type {
  Student,
  Class,
  Payment,
  Debt,
  Booking,
  Availability,
  Discussion,
  Registration,
  AdminSession,
} from "@/lib/types";

// ── id generation ──
let idSeq = 0;
const cuid = () => `m${(++idSeq).toString(36)}_${Date.now().toString(36)}`;

// ── tiny query helpers ──
function expandWhere(where: Record<string, unknown> | undefined) {
  if (where && "date_start_end" in where) {
    const { date_start_end, ...rest } = where as Record<string, unknown>;
    return { ...rest, ...(date_start_end as Record<string, unknown>) };
  }
  return where;
}

function matches(row: Record<string, unknown>, where?: Record<string, unknown>): boolean {
  const w = expandWhere(where);
  if (!w) return true;
  for (const key of Object.keys(w)) {
    const cond = w[key];
    if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
      if ("not" in (cond as object)) {
        if (row[key] === (cond as { not: unknown }).not) return false;
        continue;
      }
      if (JSON.stringify(row[key]) !== JSON.stringify(cond)) return false;
    } else if (row[key] !== cond) {
      return false;
    }
  }
  return true;
}

function compare(a: unknown, b: unknown): number {
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

type OrderBy = Record<string, "asc" | "desc">;
function sortRows<T>(rows: T[], orderBy?: OrderBy | OrderBy[]): T[] {
  if (!orderBy) return rows;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...rows].sort((x, y) => {
    for (const spec of specs) {
      const [field, dir] = Object.entries(spec)[0];
      const r = compare((x as Record<string, unknown>)[field], (y as Record<string, unknown>)[field]);
      if (r !== 0) return dir === "desc" ? -r : r;
    }
    return 0;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = any;

// Generic collection covering the simple (no-relation) models.
function collection<T extends { id: string }>(rows: T[], defaults: () => Partial<T> = () => ({})) {
  return {
    findMany: async (args: Args = {}) => {
      let r = rows.filter((x) => matches(x as Record<string, unknown>, args.where));
      r = sortRows(r, args.orderBy);
      if (args.take != null) r = r.slice(0, args.take);
      return r;
    },
    findUnique: async (args: Args) => rows.find((x) => matches(x as Record<string, unknown>, args.where)) ?? null,
    findFirst: async (args: Args = {}) =>
      sortRows(rows.filter((x) => matches(x as Record<string, unknown>, args.where)), args.orderBy)[0] ?? null,
    create: async (args: Args) => {
      const row = { id: cuid(), ...defaults(), ...args.data } as T;
      rows.push(row);
      return row;
    },
    createMany: async (args: Args) => {
      for (const d of args.data) rows.push({ id: cuid(), ...defaults(), ...d } as T);
      return { count: args.data.length };
    },
    update: async (args: Args) => {
      const row = rows.find((x) => matches(x as Record<string, unknown>, args.where));
      if (!row) throw new Error("Record not found");
      Object.assign(row, args.data);
      return row;
    },
    delete: async (args: Args) => {
      const i = rows.findIndex((x) => matches(x as Record<string, unknown>, args.where));
      if (i === -1) throw new Error("Record not found");
      return rows.splice(i, 1)[0];
    },
  };
}

// ── seed data ──
interface Store {
  students: Student[];
  classes: Class[];
  payments: Payment[];
  debts: Debt[];
  bookings: Booking[];
  availability: Availability[];
  discussions: Discussion[];
  registrations: Registration[];
  adminSession: AdminSession[];
}

// A date `days` from today at HH:mm local time.
function at(days: number, h = 10, m = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return d;
}
// YYYY-MM-DD for an availability `date`.
function ymd(days: number): string {
  const d = at(days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function seed(): Store {
  const students: Student[] = [
    { id: "stu_sara", firstName: "Sara", lastName: "Ahmadi", email: "sara@example.com", phone: "0912 000 0001", englishLevel: "Intermediate", type: "private", addedAt: at(-40, 9) },
    { id: "stu_reza", firstName: "Reza", lastName: "Karimi", email: "reza@example.com", phone: "0912 000 0002", englishLevel: "Upper-Intermediate", type: "private", addedAt: at(-25, 9) },
    { id: "stu_mina", firstName: "Mina", lastName: "Hosseini", email: "mina@example.com", phone: "0912 000 0003", englishLevel: "Beginner", type: "group", addedAt: at(-10, 9) },
  ];

  const classes: Class[] = [
    { id: "cls_1", studentId: "stu_sara", title: "Conversation practice", description: "Travel vocabulary", date: at(2, 17), duration: 60, status: "SCHEDULED", createdAt: at(-5) },
    { id: "cls_2", studentId: "stu_sara", title: "Grammar review", description: null, date: at(-7, 17), duration: 60, status: "COMPLETED", createdAt: at(-14) },
    { id: "cls_3", studentId: "stu_reza", title: "IELTS speaking mock", description: "Part 2 cue cards", date: at(3, 18, 30), duration: 90, status: "SCHEDULED", createdAt: at(-3) },
    { id: "cls_4", studentId: "stu_mina", title: "Intro lesson", description: null, date: at(-2, 16), duration: 45, status: "COMPLETED", createdAt: at(-9) },
  ];

  const payments: Payment[] = [
    { id: "pay_1", studentId: "stu_sara", amount: 3_000_000, currency: "IRR", note: "4-session package", createdAt: at(-30) },
    { id: "pay_2", studentId: "stu_reza", amount: 1_500_000, currency: "IRR", note: null, createdAt: at(-20) },
  ];

  const debts: Debt[] = [
    { id: "debt_1", studentId: "stu_mina", amount: 800_000, note: "First package balance", settled: false, createdAt: at(-8) },
  ];

  const bookings: Booking[] = [
    { id: "bk_1", name: "Ali Tehrani", email: "ali@example.com", phone: "0912 000 0010", topic: "Business English", notes: null, date: at(4, 19), duration: 60, status: "PENDING", amount: null, packageSize: null, createdAt: at(-1) },
  ];

  const availability: Availability[] = [
    { id: "av_1", date: ymd(2), start: "17:00", end: "20:00" },
    { id: "av_2", date: ymd(3), start: "16:00", end: "21:00" },
    { id: "av_3", date: ymd(4), start: "18:00", end: "21:00" },
  ];

  const discussions: Discussion[] = [
    {
      id: 1,
      topic: "Travel & Culture",
      level: "Intermediate",
      description: "Share travel stories and learn vocabulary for getting around abroad.",
      duration: "60 min",
      status: "UPCOMING",
      spots: 4,
      participants: null,
      thumbnail: null,
      points: ["Airport & hotel phrases", "Describing places", "Cultural do's and don'ts"],
      dates: [
        { id: "dd_1", discussionId: 1, date: "May 28", time: "20:00" },
        { id: "dd_2", discussionId: 1, date: "Jun 4", time: "20:00" },
      ],
      reviews: [],
    },
    {
      id: 2,
      topic: "Job Interviews",
      level: "Upper-Intermediate",
      description: "Practice answering common interview questions with confidence.",
      duration: "90 min",
      status: "COMPLETED",
      spots: null,
      participants: 6,
      thumbnail: null,
      points: [],
      dates: [{ id: "dd_3", discussionId: 2, date: "May 14", time: "19:00" }],
      reviews: [
        { id: "dr_1", discussionId: 2, name: "Sara", level: "Intermediate", text: "Really helpful — I felt much more prepared." },
        { id: "dr_2", discussionId: 2, name: "Reza", level: "Upper-Intermediate", text: "Great feedback on my answers." },
      ],
    },
  ];

  const registrations: Registration[] = [
    { id: "reg_1", type: "PRIVATE", firstName: "Nima", lastName: "Rad", email: "nima@example.com", phone: "0912 000 0020", englishLevel: "Intermediate", age: "27", job: "Engineer", whyPrivate: "Career growth", purpose: "Work meetings", whyGroup: null, topics: null, discussionId: null, discussionTopic: null, priorExperience: null, goals: null, registeredAt: at(-6) },
    { id: "reg_2", type: "DISCUSSION", firstName: "Lena", lastName: "Pir", email: "lena@example.com", phone: "0912 000 0021", englishLevel: "Beginner", age: null, job: null, whyPrivate: null, purpose: null, whyGroup: null, topics: null, discussionId: 1, discussionTopic: "Travel & Culture", priorExperience: "None", goals: "Speak more fluently", registeredAt: at(-2) },
  ];

  return { students, classes, payments, debts, bookings, availability, discussions, registrations, adminSession: [] };
}

// Persist the store across dev hot-reloads so in-session writes survive.
const globalForStore = globalThis as unknown as { __mockStore?: Store };
const store: Store = globalForStore.__mockStore ?? (globalForStore.__mockStore = seed());

let discussionSeq = store.discussions.reduce((max, d) => Math.max(max, d.id), 0);

// ── relation-aware models ──
const discussionModel = {
  findMany: async (args: Args = {}) =>
    sortRows(store.discussions.filter((d) => matches(d as unknown as Record<string, unknown>, args.where)), args.orderBy),
  findUnique: async (args: Args) =>
    store.discussions.find((d) => matches(d as unknown as Record<string, unknown>, args.where)) ?? null,
  create: async (args: Args) => {
    const { dates, reviews, ...scalar } = args.data;
    const id = ++discussionSeq;
    const row: Discussion = {
      id,
      description: null,
      spots: null,
      participants: null,
      thumbnail: null,
      points: [],
      ...scalar,
      dates: (dates?.create ?? []).map((d: { date: string; time: string }) => ({ id: cuid(), discussionId: id, ...d })),
      reviews: (reviews?.create ?? []).map((r: { name: string; level: string; text: string }) => ({ id: cuid(), discussionId: id, ...r })),
    };
    store.discussions.push(row);
    return row;
  },
  update: async (args: Args) => {
    const row = store.discussions.find((d) => matches(d as unknown as Record<string, unknown>, args.where));
    if (!row) throw new Error("Record not found");
    const { dates, reviews, ...scalar } = args.data;
    Object.assign(row, scalar);
    if (dates) row.dates = (dates.create ?? []).map((d: { date: string; time: string }) => ({ id: cuid(), discussionId: row.id, ...d }));
    if (reviews) row.reviews = (reviews.create ?? []).map((r: { name: string; level: string; text: string }) => ({ id: cuid(), discussionId: row.id, ...r }));
    return row;
  },
  delete: async (args: Args) => {
    const i = store.discussions.findIndex((d) => matches(d as unknown as Record<string, unknown>, args.where));
    if (i === -1) throw new Error("Record not found");
    return store.discussions.splice(i, 1)[0];
  },
};

// Belongs-to `student` include for classes/sessions.
function withStudent(c: Class | null): Class | null {
  if (!c) return c;
  return { ...c, student: store.students.find((s) => s.id === c.studentId) };
}

const classModel = {
  findMany: async (args: Args = {}) => {
    let r = store.classes.filter((c) => matches(c as unknown as Record<string, unknown>, args.where));
    r = sortRows(r, args.orderBy);
    if (args.take != null) r = r.slice(0, args.take);
    return args.include?.student ? r.map((c) => withStudent(c)!) : r;
  },
  findUnique: async (args: Args) => {
    const c = store.classes.find((x) => matches(x as unknown as Record<string, unknown>, args.where)) ?? null;
    return args.include?.student ? withStudent(c) : c;
  },
  create: async (args: Args) => {
    const row: Class = { id: cuid(), description: null, status: "SCHEDULED", createdAt: new Date(), ...args.data };
    store.classes.push(row);
    return row;
  },
  update: async (args: Args) => {
    const row = store.classes.find((c) => matches(c as unknown as Record<string, unknown>, args.where));
    if (!row) throw new Error("Record not found");
    Object.assign(row, args.data);
    return row;
  },
};

const adminSessionModel = {
  findUnique: async (args: Args) =>
    store.adminSession.find((a) => matches(a as unknown as Record<string, unknown>, args.where)) ?? null,
  upsert: async (args: Args) => {
    const existing = store.adminSession.find((a) => matches(a as unknown as Record<string, unknown>, args.where));
    if (existing) {
      Object.assign(existing, args.update);
      return existing;
    }
    const row = { ...args.create } as AdminSession;
    store.adminSession.push(row);
    return row;
  },
};

// ── the mock client (`db`) ──
export const db = {
  student: collection<Student>(store.students, () => ({ addedAt: new Date() })),
  class: classModel,
  payment: collection<Payment>(store.payments, () => ({ currency: "IRR", note: null, createdAt: new Date() })),
  debt: collection<Debt>(store.debts, () => ({ settled: false, note: null, createdAt: new Date() })),
  booking: collection<Booking>(store.bookings, () => ({ phone: null, notes: null, amount: null, packageSize: null, status: "PENDING", createdAt: new Date() })),
  availability: collection<Availability>(store.availability),
  discussion: discussionModel,
  registration: collection<Registration>(store.registrations, () => ({ registeredAt: new Date() })),
  adminSession: adminSessionModel,
};
