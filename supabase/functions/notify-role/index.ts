// supabase/functions/notify-role/index.ts
// Deploy with: supabase functions deploy notify-role

// @ts-ignore - Deno URL import is not recognized by default TS config
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

// Declare Deno locally so standard TS compiler doesn't complain about missing 'Deno'
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { role, title, body, icon } = await req.json();

    if (!role || !title) throw new Error('Role and Title are required');

    // Insert a notification targeting a specific role
    const { error } = await supabase
      .from('notifications')
      .insert({
        role_target: role,
        title,
        body,
        icon: icon || '🔔'
      });

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
