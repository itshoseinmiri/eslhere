-- ─────────────────────────────────────────────────────────────────────────────
-- Reference schema mirroring the in-memory mock store (lib/db.ts + lib/types.ts).
-- Apply in the Supabase SQL editor (or `supabase db push`) when you move a route
-- off the mock and onto Postgres.
--
-- NOTE ON NAMING: columns are snake_case (Postgres idiom); the app code is
-- camelCase. supabase-js returns column names verbatim, so when wiring a route
-- either alias in the SELECT (`select id, first_name as "firstName"`) or map in
-- the serializer (see lib/serialize.ts).
--
-- RLS is enabled on every table with NO policies == deny-all. Add explicit
-- policies before a client (anon key) can read/write. Server code using the
-- SERVICE ROLE key bypasses RLS.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── enums (mock stores UPPERCASE; lib/serialize.ts lowercases on the way out) ──
create type class_status       as enum ('SCHEDULED', 'COMPLETED', 'CANCELED');
create type booking_status     as enum ('PENDING', 'CONFIRMED', 'CANCELED');
create type discussion_status  as enum ('UPCOMING', 'COMPLETED');
create type registration_type  as enum ('PRIVATE', 'GROUP', 'DISCUSSION');

-- ── students ──
create table students (
  id            text primary key default gen_random_uuid()::text,
  first_name    text not null,
  last_name     text not null,
  email         text not null,
  phone         text not null,
  english_level text not null,
  type          text not null,            -- 'private' | 'group'
  added_at      timestamptz not null default now()
);

-- ── classes / sessions ──
create table classes (
  id          text primary key default gen_random_uuid()::text,
  student_id  text not null references students(id) on delete cascade,
  title       text not null,
  description text,
  date        timestamptz not null,
  duration    integer not null,           -- minutes
  status      class_status not null default 'SCHEDULED',
  created_at  timestamptz not null default now()
);
create index on classes (student_id);

-- ── payments ──
create table payments (
  id         text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  amount     bigint not null,
  currency   text not null default 'IRR',
  note       text,
  created_at timestamptz not null default now()
);
create index on payments (student_id);

-- ── debts ──
create table debts (
  id         text primary key default gen_random_uuid()::text,
  student_id text not null references students(id) on delete cascade,
  amount     bigint not null,
  note       text,
  settled    boolean not null default false,
  created_at timestamptz not null default now()
);
create index on debts (student_id);

-- ── bookings (public booking requests) ──
create table bookings (
  id           text primary key default gen_random_uuid()::text,
  name         text not null,
  email        text not null,
  phone        text,
  topic        text not null,
  notes        text,
  date         timestamptz not null,
  duration     integer not null,
  status       booking_status not null default 'PENDING',
  amount       bigint,
  package_size integer,
  created_at   timestamptz not null default now()
);

-- ── availability slots ──
create table availability (
  id    text primary key default gen_random_uuid()::text,
  date  text not null,                    -- YYYY-MM-DD
  start text not null,                    -- HH:mm
  "end" text not null                     -- HH:mm ("end" is reserved -> quoted)
);

-- ── discussions (group sessions) ──
create table discussions (
  id           bigint generated always as identity primary key,
  topic        text not null,
  level        text not null,
  description  text,
  duration     text not null,             -- e.g. '60 min'
  status       discussion_status not null default 'UPCOMING',
  spots        integer,
  participants integer,
  thumbnail    text,
  points       text[] not null default '{}'
);

-- id is bigint identity so ordering by id == insertion order (dates/reviews are
-- replaced wholesale on edit and re-inserted in array order — see lib/supabase/queries.ts).
create table discussion_dates (
  id            bigint generated always as identity primary key,
  discussion_id bigint not null references discussions(id) on delete cascade,
  date          text not null,
  time          text not null
);
create index on discussion_dates (discussion_id);

create table discussion_reviews (
  id            bigint generated always as identity primary key,
  discussion_id bigint not null references discussions(id) on delete cascade,
  name          text not null,
  level         text not null,
  text          text not null
);
create index on discussion_reviews (discussion_id);

-- ── registrations (private / group / discussion sign-ups) ──
create table registrations (
  id                text primary key default gen_random_uuid()::text,
  type              registration_type not null,
  first_name        text not null,
  last_name         text not null,
  email             text not null,
  phone             text not null,
  english_level     text not null,
  age               text,
  job               text,
  why_private       text,
  purpose           text,
  why_group         text,
  topics            text,
  discussion_id     bigint references discussions(id) on delete set null,
  discussion_topic  text,
  prior_experience  text,
  goals             text,
  registered_at     timestamptz not null default now()
);

-- ── admin session (single-row custom admin token; see lib/auth.ts) ──
create table admin_session (
  id           text primary key,          -- always 'admin'
  access_token text,
  expired_at   timestamptz
);

-- ── enable RLS (deny-all until policies are added) ──
alter table students           enable row level security;
alter table classes            enable row level security;
alter table payments           enable row level security;
alter table debts              enable row level security;
alter table bookings           enable row level security;
alter table availability       enable row level security;
alter table discussions        enable row level security;
alter table discussion_dates   enable row level security;
alter table discussion_reviews enable row level security;
alter table registrations      enable row level security;
alter table admin_session      enable row level security;

-- Example policies to uncomment when a public page needs read access:
-- create policy "public read discussions"  on discussions        for select using (true);
-- create policy "public read dates"        on discussion_dates   for select using (true);
-- create policy "public read reviews"      on discussion_reviews for select using (true);
-- create policy "public read availability" on availability       for select using (true);
-- Public booking/registration submit (anon insert):
-- create policy "anon submit booking"      on bookings      for insert with check (true);
-- create policy "anon submit registration" on registrations for insert with check (true);
