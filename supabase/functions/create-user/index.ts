// supabase/functions/create-user/index.ts
// Deploy with: supabase functions deploy create-user
// This function runs with the SERVICE ROLE key (server-side only, never exposed to the browser).

// @ts-ignore - Deno URL import is not recognized by default TS config
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Declare Deno locally so standard TS compiler doesn't complain about missing 'Deno'
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Admin client — uses SERVICE_ROLE key (set in Supabase dashboard → Functions → Secrets)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // ── 1. Verify the caller is a logged-in manager ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return json({ error: 'Missing Authorization header' }, 401);
    }
    const { data: { user: caller }, error: callerErr } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (callerErr || !caller) return json({ error: 'Unauthorized' }, 401);

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single();
    if (callerProfile?.role !== 'manager') return json({ error: 'Only managers can create users' }, 403);

    // ── 2. Parse & validate body ──
    const body: Record<string, any> = await req.json();
    const { email, password, name, role, dept, clientAccountId, color, avatar } = body;
    if (!email || !password || !name || !role) return json({ error: 'Missing required fields' }, 400);
    if (!['employee', 'client'].includes(role)) return json({ error: 'Role must be employee or client' }, 400);

    // ── 3. Create auth user ──
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,   // skip email verification for manager-provisioned accounts
    });
    if (createErr) return json({ error: createErr.message }, 400);
    if (!created?.user) return json({ error: 'Failed to create user (unknown error)' }, 500);

    // ── 4. Create profile row ──
    const userId = created.user.id;
    const avatarStr = avatar || String(name).trim().split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
      id:        userId,
      name:      String(name).trim(),
      email:     email.trim().toLowerCase(),
      role,
      dept:      role === 'employee' ? (dept || null) : null,
      color:     role === 'employee' ? (color || '#7c3aed') : null,
      avatar:    avatarStr,
      client_id: role === 'client' ? (clientAccountId || null) : null,
      is_active: true,
    });

    if (profileErr) {
      // Rollback: delete the orphaned auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return json({ error: profileErr.message }, 500);
    }

    return json({ success: true, userId }, 200);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return json({ error: msg }, 500);
  }
});

function json(body: object, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
