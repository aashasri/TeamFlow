-- supabase/migrations/009_notification_role_target.sql
-- Add role_target to notifications to support system-wide role alerts

alter table public.notifications
add column if not exists role_target text;

comment on column public.notifications.role_target is 'If set, all users with this role can see this notification.';
