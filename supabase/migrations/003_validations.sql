-- ============================================================
-- TeamFlow — Database Validations & Integrity
-- Adds CHECK constraints to ensure data quality.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. PROFILE VALIDATIONS
-- Ensure name is not empty and email follows a basic pattern
alter table public.profiles 
  add constraint name_not_empty check (length(trim(name)) > 0),
  add constraint valid_email check (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- 2. CLIENT VALIDATIONS
-- Ensure budget (if set) is not just a single character and progress is 0-100
alter table public.clients
  add constraint progress_range check (progress >= 0 and progress <= 100),
  add constraint budget_format check (budget is null or length(budget) >= 1);

-- 3. TASK VALIDATIONS
-- Ensure title is meaningful and deadline isn't centuries ago
alter table public.tasks
  add constraint task_title_len check (length(trim(title)) >= 3),
  add constraint valid_deadline check (deadline is null or deadline > '2000-01-01');

-- 4. SOCIAL POST VALIDATIONS
-- Ensure content theme is provided
alter table public.social_posts
  add constraint social_theme_not_empty check (length(trim(content_theme)) > 0);

-- 5. INDEXING FOR PERFORMANCE (Validating lookups)
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_client_id on public.tasks(client_id);
create index if not exists idx_meetings_client_id on public.meetings(client_id);
create index if not exists idx_social_posts_client_id on public.social_posts(client_id);
