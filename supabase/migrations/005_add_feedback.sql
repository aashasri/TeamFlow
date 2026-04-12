-- Add missing feedback column to tasks table for manager remarks
alter table public.tasks 
add column if not exists feedback text;

-- Ensure the column is accessible (usually fine since RLS allows select/update on existing policies)
comment on column public.tasks.feedback is 'Manager remarks/feedback on task submissions';
