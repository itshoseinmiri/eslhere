// TEMPORARY diagnostic — remove after debugging prod 500s.
// Reports runtime env-var presence (never values) and the real Supabase error.
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const env = {
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasService: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    serviceLen: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length,
    hasAdminEmail: Boolean(process.env.ADMIN_EMAIL),
    urlHost: (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^https?:\/\//, '').split('.')[0],
  };

  let dbError: unknown = null;
  let dbOk = false;
  try {
    const { error } = await supabaseAdmin().from('discussions').select('id').limit(1);
    dbError = error ? { code: error.code, message: error.message } : null;
    dbOk = !error;
  } catch (e) {
    dbError = { thrown: e instanceof Error ? e.message : String(e) };
  }

  return Response.json({ env, dbOk, dbError });
}
