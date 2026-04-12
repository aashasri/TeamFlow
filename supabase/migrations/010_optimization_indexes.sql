-- supabase/migrations/010_optimization_indexes.sql
-- Add indexes to frequently filtered columns to speed up dashboard queries

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON public.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_dept ON public.tasks (dept);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks (status);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_role_target ON public.notifications (role_target);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_posts_client_id ON public.social_posts (client_id);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON public.social_posts (status);

CREATE INDEX IF NOT EXISTS idx_meeting_attendees_meeting_id ON public.meeting_attendees (meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_user_id ON public.meeting_attendees (user_id);

COMMENT ON TABLE public.tasks IS 'Includes indexes for faster manager/employee dashboard views';
