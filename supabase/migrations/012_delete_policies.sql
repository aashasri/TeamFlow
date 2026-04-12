-- ============================================================
-- Migration 012: Add DELETE policies for profiles and related tables
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================

-- Allow authenticated users (managers) to delete profiles
drop policy if exists "Authenticated delete profiles" on public.profiles;
create policy "Authenticated delete profiles"
  on public.profiles for delete
  using (auth.role() = 'authenticated');

-- Allow authenticated users to delete calendar notes (for cascade cleanup)
drop policy if exists "Authenticated delete calendar notes" on public.calendar_notes;
create policy "Authenticated delete calendar notes"
  on public.calendar_notes for delete
  using (auth.role() = 'authenticated');

-- Ensure tasks policy covers DELETE (the existing 'for all' should cover it,
-- but let's be explicit in case it was overridden)
drop policy if exists "Authenticated delete tasks" on public.tasks;
create policy "Authenticated delete tasks"
  on public.tasks for delete
  using (auth.role() = 'authenticated');

-- Ensure meeting_attendees policy covers DELETE
drop policy if exists "Authenticated delete attendees" on public.meeting_attendees;
create policy "Authenticated delete attendees"
  on public.meeting_attendees for delete
  using (auth.role() = 'authenticated');
