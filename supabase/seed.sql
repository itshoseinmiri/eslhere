-- Optional sample data for the "active students" and "manage discussions" admin
-- screens — mirrors the old in-memory mock seed (lib/db.ts). Run AFTER schema.sql,
-- in the Supabase SQL editor. Re-runnable: it clears these tables first.
--
-- Dates are relative to now() so the upcoming/past split on the student profile
-- stays meaningful over time.

-- clean (children first)
delete from discussion_reviews;
delete from discussion_dates;
delete from discussions;
delete from debts;
delete from payments;
delete from classes;
delete from students;

-- ── students ──
insert into students (id, first_name, last_name, email, phone, english_level, type, added_at) values
  ('stu_sara', 'Sara', 'Ahmadi',   'sara@example.com', '0912 000 0001', 'Intermediate',       'private', now() - interval '40 days'),
  ('stu_reza', 'Reza', 'Karimi',   'reza@example.com', '0912 000 0002', 'Upper-Intermediate', 'private', now() - interval '25 days'),
  ('stu_mina', 'Mina', 'Hosseini', 'mina@example.com', '0912 000 0003', 'Beginner',           'group',   now() - interval '10 days');

-- ── classes / sessions ──
insert into classes (id, student_id, title, description, date, duration, status, created_at) values
  ('cls_1', 'stu_sara', 'Conversation practice', 'Travel vocabulary', date_trunc('day', now()) + interval '2 days'  + interval '17 hours',              60, 'SCHEDULED', now() - interval '5 days'),
  ('cls_2', 'stu_sara', 'Grammar review',        null,                date_trunc('day', now()) - interval '7 days'  + interval '17 hours',              60, 'COMPLETED', now() - interval '14 days'),
  ('cls_3', 'stu_reza', 'IELTS speaking mock',   'Part 2 cue cards',  date_trunc('day', now()) + interval '3 days'  + interval '18 hours 30 minutes',   90, 'SCHEDULED', now() - interval '3 days'),
  ('cls_4', 'stu_mina', 'Intro lesson',          null,                date_trunc('day', now()) - interval '2 days'  + interval '16 hours',              45, 'COMPLETED', now() - interval '9 days');

-- ── payments ──
insert into payments (id, student_id, amount, currency, note, created_at) values
  ('pay_1', 'stu_sara', 3000000, 'IRR', '4-session package', now() - interval '30 days'),
  ('pay_2', 'stu_reza', 1500000, 'IRR', null,                now() - interval '20 days');

-- ── debts ──
insert into debts (id, student_id, amount, note, settled, created_at) values
  ('debt_1', 'stu_mina', 800000, 'First package balance', false, now() - interval '8 days');

-- ── discussions (ids are identity-generated; children linked by topic) ──
insert into discussions (topic, level, description, duration, status, spots, participants, points) values
  ('Travel & Culture', 'Intermediate',       'Share travel stories and learn vocabulary for getting around abroad.', '60 min', 'UPCOMING',  4,    null, array['Airport & hotel phrases', 'Describing places', 'Cultural do''s and don''ts']),
  ('Job Interviews',   'Upper-Intermediate', 'Practice answering common interview questions with confidence.',        '90 min', 'COMPLETED', null, 6,    array[]::text[]);

insert into discussion_dates (discussion_id, date, time) values
  ((select id from discussions where topic = 'Travel & Culture'), 'May 28', '20:00'),
  ((select id from discussions where topic = 'Travel & Culture'), 'Jun 4',  '20:00'),
  ((select id from discussions where topic = 'Job Interviews'),   'May 14', '19:00');

insert into discussion_reviews (discussion_id, name, level, text) values
  ((select id from discussions where topic = 'Job Interviews'), 'Sara', 'Intermediate',       'Really helpful — I felt much more prepared.'),
  ((select id from discussions where topic = 'Job Interviews'), 'Reza', 'Upper-Intermediate', 'Great feedback on my answers.');
