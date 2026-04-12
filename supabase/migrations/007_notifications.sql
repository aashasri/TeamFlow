-- supabase/migrations/007_notifications.sql
-- In-app notification system for TeamFlow

create table if not exists public.notifications (
  id          uuid        primary key default uuid_generate_v4(),
  user_id     uuid        not null references public.profiles(id) on delete cascade,
  title       text        not null,
  body        text        not null,
  icon        text        default '📣',
  read        boolean     default false,
  created_at  timestamptz default now()
);

-- Enable RLS
alter table public.notifications enable row level security;

-- Policies
create policy "Users can see their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications (read status)"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Anyone authenticated can create notifications"
  on public.notifications for insert
  with check (auth.role() = 'authenticated');

comment on table public.notifications is 'Global in-app notifications shared between managers and employees';
