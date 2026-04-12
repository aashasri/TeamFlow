-- ============================================================
-- TeamFlow — Supabase Migration 002
-- Extends the schema with newer backend features.
-- Run this in your Supabase SQL Editor AFTER 001_init.sql
-- ============================================================

-- ── Tables ──────────────────────────────────────────────────

create table if not exists public.social_posts (
  id             text        primary key,
  client_id      text        references public.clients(id) on delete cascade,
  content_theme  text        not null,
  content_type   text        not null,
  publish_date   date,
  time           text,
  boost          text        default 'No',
  budget         text,
  status         text        default 'Draft',
  links          jsonb       default '{}'::jsonb,
  created_at     timestamptz default now()
);

create table if not exists public.client_page_details (
  client_id      text        not null references public.clients(id) on delete cascade,
  platform       text        not null,
  details        jsonb       default '{}'::jsonb,
  created_at     timestamptz default now(),
  primary key (client_id, platform)
);

-- ── Row Level Security ───────────────────────────────────────

alter table public.social_posts enable row level security;
alter table public.client_page_details enable row level security;

-- Any authenticated user can manage social posts
drop policy if exists "Authenticated manage social posts" on public.social_posts;
create policy "Authenticated manage social posts"
  on public.social_posts for all
  using (auth.role() = 'authenticated');

-- Any authenticated user can manage client page details
drop policy if exists "Authenticated manage client page details" on public.client_page_details;
create policy "Authenticated manage client page details"
  on public.client_page_details for all
  using (auth.role() = 'authenticated');

