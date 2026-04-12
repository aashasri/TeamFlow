import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/** True when Supabase credentials are not yet configured — uses local demo data instead. */
export const DEMO_MODE =
  !supabaseUrl ||
  supabaseUrl.includes('YOUR_PROJECT_ID') ||
  !supabaseAnonKey ||
  supabaseAnonKey.includes('YOUR_ANON_KEY');

export const supabase = DEMO_MODE
  ? null   // not used in demo mode
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        // ⚡ FIX: Bypass Web Locks API to prevent session storage deadlock
        // (gotrue-js "Lock was not released within 5000ms" hang)
        lock: async (_name, _acquireTimeout, fn) => fn(),
        storageKey: 'sb-hieibtzixojdpllsyhlh-auth-token',
      },
    });

if (DEMO_MODE) {
  console.info('[TeamFlow] Running in DEMO MODE — add Supabase credentials to .env to enable real auth.');
}
