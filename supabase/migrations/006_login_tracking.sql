-- supabase/migrations/006_login_tracking.sql
-- Table to track daily login hours/seconds for employees and managers

create table if not exists public.login_track (
  id           uuid        primary key default uuid_generate_v4(),
  user_id      uuid        not null references public.profiles(id) on delete cascade,
  date         date        not null default current_date,
  total_seconds integer    not null default 0,
  last_sync    timestamptz default now(),
  unique (user_id, date)
);

-- Enable RLS
alter table public.login_track enable row level security;

-- Policies
drop policy if exists "Users can manage their own tracking" on public.login_track;
create policy "Users can manage their own tracking"
  on public.login_track for all
  using (auth.uid() = user_id);

drop policy if exists "Managers can view all tracking" on public.login_track;
create policy "Managers can view all tracking"
  on public.login_track for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'manager'
    )
  );

comment on table public.login_track is 'Tracks daily active seconds per user for performance reporting';
