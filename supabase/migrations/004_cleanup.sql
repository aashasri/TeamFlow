-- ============================================================
-- TeamFlow — Database Cleanup
-- Removes all users except the primary testing accounts.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- Wrap in a transaction to ensure atomicity and avoid partial schema locks
BEGIN;

-- 1. Identify and keep only these users:
-- - Manager: ashakalva26@gmail.com
-- - Employee: sarah@teamflow.com
-- - Client: client1@acme.com

-- 2. Performance note: ON DELETE CASCADE is set on the profiles table,
--    so deleting from auth.users will automatically clean up public.profiles,
--    meeting_attendees, and calendar_notes.

DELETE FROM auth.users 
WHERE email NOT IN (
  'ashakalva26@gmail.com', 
  'sarah@teamflow.com', 
  'client1@acme.com'
);

-- 3. Additional Cleanup: Remove clients that are no longer needed
-- (Keeping only Acme Corp which is linked to client1@acme.com)
DELETE FROM public.clients
WHERE id NOT IN (
  SELECT client_id FROM public.profiles WHERE email = 'client1@acme.com'
) AND id != 'cl1';

-- 4. Final check: Ensure the Manager profile is definitely active
UPDATE public.profiles 
SET is_active = true 
WHERE email = 'ashakalva26@gmail.com';

COMMIT;
