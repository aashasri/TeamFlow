-- ============================================================
-- TeamFlow — Supabase Migration 011
-- Relaxes check constraints to allow 'review' and 'approved' statuses.
-- Also ensures no syntax issues regarding done status checks.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. Drop the old constraint
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- 2. Add the new constraint allowing modern app workflow states
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check
CHECK (status in ('todo','inprogress','review','approved','done'));
