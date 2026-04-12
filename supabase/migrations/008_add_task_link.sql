-- supabase/migrations/008_add_task_link.sql
-- Add link column to tasks table to support employee work submissions

alter table public.tasks 
add column if not exists link text;

comment on column public.tasks.link is 'Optional URL link to work submitted by employees.';
