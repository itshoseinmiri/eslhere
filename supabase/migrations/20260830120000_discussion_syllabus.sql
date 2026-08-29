-- Discussion syllabus fields backing the /discussions/<id> detail sections:
-- "What you'll learn?" (learn), "Requirements" (requirements) and the
-- "Course curriculum" accordion (discussion_curriculum modules).
-- Idempotent so it is safe to re-run.

alter table discussions add column if not exists learn        text[] not null default '{}';
alter table discussions add column if not exists requirements text[] not null default '{}';

-- One row per accordion tab. Like discussion_dates/discussion_reviews these are
-- replaced wholesale on edit, so identity order == the order the admin entered.
create table if not exists discussion_curriculum (
  id            bigint generated always as identity primary key,
  discussion_id bigint not null references discussions(id) on delete cascade,
  title         text not null,
  summary       text not null default '',
  items         text[] not null default '{}'
);
create index if not exists discussion_curriculum_discussion_id_idx on discussion_curriculum (discussion_id);

-- Deny-all RLS; route handlers use the service-role client which bypasses it.
alter table discussion_curriculum enable row level security;
