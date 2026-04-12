-- ============================================================
-- TeamFlow — Supabase Database Setup & Seed
-- Run this entire script in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Tables ──────────────────────────────────────────────────

create table if not exists public.profiles (
  id         uuid        primary key references auth.users(id) on delete cascade,
  name       text        not null,
  email      text        not null unique,
  role       text        not null check (role in ('manager','employee','client')),
  dept       text,
  avatar     text,
  color      text,
  client_id  text,
  is_active  boolean     default true,
  created_at timestamptz default now()
);

create table if not exists public.clients (
  id         text        primary key,
  name       text        not null,
  project    text,
  progress   integer     default 0,
  status     text        default 'active' check (status in ('active','review','pending','completed')),
  manager    text,
  budget     text,
  start_date date,
  end_date   date,
  created_at timestamptz default now()
);

create table if not exists public.tasks (
  id             text        primary key,
  title          text        not null,
  "desc"         text,
  assigned_to    uuid        references public.profiles(id) on delete set null,
  assigned_name  text,
  dept           text,
  client_id      text        references public.clients(id) on delete set null,
  priority       text        default 'medium' check (priority in ('low','medium','high')),
  status         text        default 'todo'   check (status in ('todo','inprogress','done')),
  deadline       date,
  logged_seconds integer     default 0,
  scheduled_time text,
  done_at        timestamptz,
  feedback       text,
  created_at     timestamptz default now()
);

create table if not exists public.meetings (
  id         text        primary key,
  title      text        not null,
  date       date        not null,
  time       text        not null,
  type       text        default 'internal' check (type in ('internal','client')),
  client_id  text        references public.clients(id) on delete set null,
  "desc"     text,
  link       text,
  created_at timestamptz default now()
);

create table if not exists public.meeting_attendees (
  meeting_id text references public.meetings(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  primary key (meeting_id, user_id)
);

create table if not exists public.calendar_notes (
  id         uuid        primary key default uuid_generate_v4(),
  user_id    uuid        not null references public.profiles(id) on delete cascade,
  date_key   text        not null,
  note       text,
  unique (user_id, date_key)
);

-- ── Row Level Security ───────────────────────────────────────

alter table public.profiles         enable row level security;
alter table public.clients          enable row level security;
alter table public.tasks            enable row level security;
alter table public.meetings         enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.calendar_notes   enable row level security;

-- Profiles: any authenticated user can view; only service role inserts (via edge fn)
drop policy if exists "Authenticated read profiles" on public.profiles;
create policy "Authenticated read profiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

drop policy if exists "Service role insert profiles" on public.profiles;
create policy "Service role insert profiles"
  on public.profiles for insert
  with check (true);

drop policy if exists "Owner update profile" on public.profiles;
create policy "Owner update profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Clients: any authenticated can read/insert/update
drop policy if exists "Authenticated manage clients" on public.clients;
create policy "Authenticated manage clients"
  on public.clients for all
  using (auth.role() = 'authenticated');

-- Tasks: any authenticated can read/insert/update
drop policy if exists "Authenticated manage tasks" on public.tasks;
create policy "Authenticated manage tasks"
  on public.tasks for all
  using (auth.role() = 'authenticated');

-- Meetings: any authenticated can read/insert
drop policy if exists "Authenticated manage meetings" on public.meetings;
create policy "Authenticated manage meetings"
  on public.meetings for all
  using (auth.role() = 'authenticated');

-- Meeting attendees: any authenticated can read/insert
drop policy if exists "Authenticated manage attendees" on public.meeting_attendees;
create policy "Authenticated manage attendees"
  on public.meeting_attendees for all
  using (auth.role() = 'authenticated');

-- Calendar notes: users manage only their own notes
drop policy if exists "Own calendar notes" on public.calendar_notes;
create policy "Own calendar notes"
  on public.calendar_notes for all
  using (auth.uid() = user_id);

-- ── Seed: Auth Users ─────────────────────────────────────────
-- Fixed UUIDs so profiles FK references work.
-- Using a DO block to ensure existence checks on both ID and EMAIL.
DO $$
BEGIN
  -- admin@teamflow.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000001' OR email = 'admin@teamflow.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000001','authenticated','authenticated','admin@teamflow.com', crypt('admin123', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;

  -- sarah@teamflow.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000002' OR email = 'sarah@teamflow.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000002','authenticated','authenticated','sarah@teamflow.com', crypt('password123', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;

  -- john@teamflow.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000003' OR email = 'john@teamflow.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000003','authenticated','authenticated','john@teamflow.com', crypt('password123', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;

  -- mia@teamflow.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000004' OR email = 'mia@teamflow.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000004','authenticated','authenticated','mia@teamflow.com', crypt('password123', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;

  -- carlos@teamflow.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000005' OR email = 'carlos@teamflow.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000005','authenticated','authenticated','carlos@teamflow.com', crypt('password123', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;

  -- priya@teamflow.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000006' OR email = 'priya@teamflow.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000006','authenticated','authenticated','priya@teamflow.com', crypt('password123', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;

  -- tom@teamflow.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000007' OR email = 'tom@teamflow.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000007','authenticated','authenticated','tom@teamflow.com', crypt('password123', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;

  -- client1@acme.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'c0000000-0000-0000-0000-000000000001' OR email = 'client1@acme.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000001','authenticated','authenticated','client1@acme.com', crypt('client123', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;

  -- client2@beta.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'c0000000-0000-0000-0000-000000000002' OR email = 'client2@beta.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000002','authenticated','authenticated','client2@beta.com', crypt('client123', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;

  -- client3@gamma.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'c0000000-0000-0000-0000-000000000003' OR email = 'client3@gamma.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000003','authenticated','authenticated','client3@gamma.com', crypt('client123', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;

  -- client4@delta.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'c0000000-0000-0000-0000-000000000004' OR email = 'client4@delta.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','c0000000-0000-0000-0000-000000000004','authenticated','authenticated','client4@delta.com', crypt('client123', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;

  -- ashakalva26@gmail.com
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = 'a0000000-0000-0000-0000-000000000008' OR email = 'ashakalva26@gmail.com') THEN
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, is_sso_user)
    values ('00000000-0000-0000-0000-000000000000','a0000000-0000-0000-0000-000000000008','authenticated','authenticated','ashakalva26@gmail.com', crypt('Aasha@04', gen_salt('bf',10)), now(), now(), now(), '{"provider":"email","providers":["email"]}','{}', false, false);
  END IF;
END $$;

-- ── Seed: Profiles ───────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000001' OR email = 'admin@teamflow.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('a0000000-0000-0000-0000-000000000001','Alex Rivera', 'admin@teamflow.com', 'manager', 'Management', 'AR', '#7c3aed', null);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000002' OR email = 'sarah@teamflow.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('a0000000-0000-0000-0000-000000000002','Sarah Johnson', 'sarah@teamflow.com', 'employee', 'Social Media','SJ', '#0ea5e9', null);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000003' OR email = 'john@teamflow.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('a0000000-0000-0000-0000-000000000003','John Park', 'john@teamflow.com', 'employee', 'SEO', 'JP', '#10b981', null);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000004' OR email = 'mia@teamflow.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('a0000000-0000-0000-0000-000000000004','Mia Chen', 'mia@teamflow.com', 'employee', 'Web Dev', 'MC', '#f59e0b', null);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000005' OR email = 'carlos@teamflow.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('a0000000-0000-0000-0000-000000000005','Carlos Mendez', 'carlos@teamflow.com', 'employee', 'Ads', 'CM', '#ef4444', null);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000006' OR email = 'priya@teamflow.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('a0000000-0000-0000-0000-000000000006','Priya Sharma', 'priya@teamflow.com', 'employee', 'Blogs', 'PS', '#ec4899', null);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000007' OR email = 'tom@teamflow.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('a0000000-0000-0000-0000-000000000007','Tom Wright', 'tom@teamflow.com', 'employee', 'Reports', 'TW', '#6366f1', null);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'c0000000-0000-0000-0000-000000000001' OR email = 'client1@acme.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('c0000000-0000-0000-0000-000000000001','Acme Corp', 'client1@acme.com', 'client', null, 'AC', null, 'cl1');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'c0000000-0000-0000-0000-000000000002' OR email = 'client2@beta.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('c0000000-0000-0000-0000-000000000002','Beta Ltd', 'client2@beta.com', 'client', null, 'BL', null, 'cl2');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'c0000000-0000-0000-0000-000000000003' OR email = 'client3@gamma.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('c0000000-0000-0000-0000-000000000003','Gamma Inc', 'client3@gamma.com', 'client', null, 'GI', null, 'cl3');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'c0000000-0000-0000-0000-000000000004' OR email = 'client4@delta.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('c0000000-0000-0000-0000-000000000004','Delta Studio', 'client4@delta.com', 'client', null, 'DS', null, 'cl4');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = 'a0000000-0000-0000-0000-000000000008' OR email = 'ashakalva26@gmail.com') THEN
    insert into public.profiles (id, name, email, role, dept, avatar, color, client_id) values ('a0000000-0000-0000-0000-000000000008','Asha Kalva', 'ashakalva26@gmail.com', 'manager', 'Management', 'AK', '#10b981', null);
  END IF;
END $$;

-- ── Seed: Clients ────────────────────────────────────────────
insert into public.clients (id, name, project, progress, status, manager, budget, start_date, end_date) values
  ('cl1','Acme Corp',    'E-Commerce Revamp',     72, 'active',  'Alex Rivera', '$48,000', '2026-01-10', '2026-05-30'),
  ('cl2','Beta Ltd',     'SEO Domination',        45, 'active',  'Alex Rivera', '$22,000', '2026-02-01', '2026-06-15'),
  ('cl3','Gamma Inc',    'Brand Social Campaign', 88, 'review',  'Alex Rivera', '$31,500', '2025-11-01', '2026-04-01'),
  ('cl4','Delta Studio', 'Ad Campaign Q2',        20, 'pending', 'Alex Rivera', '$15,000', '2026-03-15', '2026-07-01')
on conflict (id) do nothing;

-- ── Seed: Tasks ──────────────────────────────────────────────
insert into public.tasks (id, title, "desc", assigned_to, assigned_name, dept, client_id, priority, status, deadline, logged_seconds) values
  ('t1', 'Design Instagram Story Pack',  'Create 10 story templates for Acme Corp',        'a0000000-0000-0000-0000-000000000002','Sarah Johnson','Social Media','cl1','high',  'done',      '2026-03-10', 7200),
  ('t2', 'Schedule March Content',       'Plan and schedule all March social posts',         'a0000000-0000-0000-0000-000000000002','Sarah Johnson','Social Media','cl1','medium','inprogress', '2026-03-25', 3600),
  ('t3', 'Facebook Ad Creative',         'Design creatives for upcoming ad campaign',        'a0000000-0000-0000-0000-000000000002','Sarah Johnson','Social Media','cl2','high',  'todo',      '2026-03-28', 0),
  ('t4', 'Keyword Research — Beta',      'Find top 50 keywords for Beta Ltd blog',          'a0000000-0000-0000-0000-000000000003','John Park',    'SEO',         'cl2','high',  'done',      '2026-03-08', 5400),
  ('t5', 'On-Page Audit Report',         'Audit Gamma Inc website for on-page SEO',         'a0000000-0000-0000-0000-000000000003','John Park',    'SEO',         'cl3','medium','inprogress', '2026-03-26', 1800),
  ('t6', 'Backlink Outreach Campaign',   '30 outreach emails for link building',            'a0000000-0000-0000-0000-000000000003','John Park',    'SEO',         'cl2','low',   'todo',      '2026-04-05', 0),
  ('t7', 'Landing Page Redesign',        'Redesign Acme Corp landing page in React',        'a0000000-0000-0000-0000-000000000004','Mia Chen',     'Web Dev',     'cl1','high',  'done',      '2026-03-12', 14400),
  ('t8', 'Cart Bug Fix',                 'Fix checkout flow bug on mobile devices',         'a0000000-0000-0000-0000-000000000004','Mia Chen',     'Web Dev',     'cl1','high',  'done',      '2026-03-15', 3600),
  ('t9', 'CMS Integration',              'Integrate headless CMS for blog section',         'a0000000-0000-0000-0000-000000000004','Mia Chen',     'Web Dev',     'cl1','medium','inprogress', '2026-03-30', 9000),
  ('t10','Google Ads Campaign — Q1',     'Set up and launch Google Ads for Delta Studio',   'a0000000-0000-0000-0000-000000000005','Carlos Mendez','Ads',         'cl4','high',  'done',      '2026-03-18', 5400),
  ('t11','Retargeting Pixels Setup',     'Install retargeting on Beta Ltd site',            'a0000000-0000-0000-0000-000000000005','Carlos Mendez','Ads',         'cl2','medium','todo',      '2026-03-29', 0),
  ('t12','5 Blog Articles — Gamma',      'Write 5 SEO-optimized articles for Gamma Inc',   'a0000000-0000-0000-0000-000000000006','Priya Sharma', 'Blogs',       'cl3','medium','done',      '2026-03-14', 10800),
  ('t13','Email Newsletter Draft',       'Draft March newsletter for Beta Ltd',             'a0000000-0000-0000-0000-000000000006','Priya Sharma', 'Blogs',       'cl2','low',   'inprogress','2026-03-27', 2700),
  ('t14','Monthly Analytics Report',     'Compile March analytics report for all clients',  'a0000000-0000-0000-0000-000000000007','Tom Wright',   'Reports',     'cl1','high',  'inprogress','2026-03-31', 3600),
  ('t15','Q1 Performance Summary',       'Q1 summary deck for manager review',              'a0000000-0000-0000-0000-000000000007','Tom Wright',   'Reports',     null, 'high',  'done',      '2026-03-20', 7200)
on conflict (id) do nothing;

-- ── Seed: Meetings ───────────────────────────────────────────
insert into public.meetings (id, title, date, time, type, client_id) values
  ('m1','Weekly Team Standup',      '2026-03-24','09:00','internal', null),
  ('m2','Acme Corp Monthly Review', '2026-03-26','14:00','client',   'cl1'),
  ('m3','Beta Ltd SEO Kickoff',     '2026-03-28','11:00','client',   'cl2'),
  ('m4','Q2 Planning Session',      '2026-04-01','10:00','internal', null)
on conflict (id) do nothing;

insert into public.meeting_attendees (meeting_id, user_id) values
  ('m1','a0000000-0000-0000-0000-000000000002'),
  ('m1','a0000000-0000-0000-0000-000000000003'),
  ('m1','a0000000-0000-0000-0000-000000000004'),
  ('m1','a0000000-0000-0000-0000-000000000005'),
  ('m1','a0000000-0000-0000-0000-000000000006'),
  ('m1','a0000000-0000-0000-0000-000000000007'),
  ('m2','a0000000-0000-0000-0000-000000000001'),
  ('m2','a0000000-0000-0000-0000-000000000002'),
  ('m2','a0000000-0000-0000-0000-000000000004'),
  ('m3','a0000000-0000-0000-0000-000000000001'),
  ('m3','a0000000-0000-0000-0000-000000000003'),
  ('m4','a0000000-0000-0000-0000-000000000001'),
  ('m4','a0000000-0000-0000-0000-000000000002'),
  ('m4','a0000000-0000-0000-0000-000000000003'),
  ('m4','a0000000-0000-0000-0000-000000000004'),
  ('m4','a0000000-0000-0000-0000-000000000005'),
  ('m4','a0000000-0000-0000-0000-000000000006'),
  ('m4','a0000000-0000-0000-0000-000000000007')
on conflict (meeting_id, user_id) do nothing;
