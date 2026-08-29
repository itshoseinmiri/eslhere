-- teacher_reviews table + review_status enum.
-- Present in supabase/schema.sql but never applied to the deployed DB, so
-- /api/reviews (GET and POST) 500s with "relation teacher_reviews does not exist".
-- Idempotent so it is safe to re-run.

do $$ begin
  create type review_status as enum ('PENDING', 'APPROVED');
exception when duplicate_object then null;
end $$;

create table if not exists teacher_reviews (
  id         text primary key default gen_random_uuid()::text,
  name       text not null,
  level      text not null,             -- e.g. 'B1–B2'
  rating     integer not null,          -- 1..5
  text       text not null,
  status     review_status not null default 'PENDING',
  created_at timestamptz not null default now()
);
create index if not exists teacher_reviews_status_idx on teacher_reviews (status);

-- Deny-all RLS; route handlers use the service-role client which bypasses it.
alter table teacher_reviews enable row level security;
