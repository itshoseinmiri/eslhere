// TEMPORARY diagnostic — remove after debugging prod 500s.
// Reports runtime env-var presence (never values) from both process.env and the
// Cloudflare worker env, plus the real Supabase error.
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  const proc = {
    hasUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnon: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    hasService: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    serviceLen: (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length,
    hasAdminEmail: Boolean(process.env.ADMIN_EMAIL),
  };

  // Cloudflare worker env (where secrets actually live under OpenNext)
  let cf: unknown = { note: 'getCloudflareContext unavailable' };
  try {
    const mod = await import('@opennextjs/cloudflare');
    const env = mod.getCloudflareContext().env as Record<string, unknown>;
    cf = {
      hasUrl: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
      hasAnon: Boolean(env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      hasService: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
      serviceLen: typeof env.SUPABASE_SERVICE_ROLE_KEY === 'string' ? env.SUPABASE_SERVICE_ROLE_KEY.length : 0,
      hasAdminEmail: Boolean(env.ADMIN_EMAIL),
    };
  } catch (e) {
    cf = { error: e instanceof Error ? e.message : String(e) };
  }

  let dbError: unknown = null;
  let dbOk = false;
  try {
    const { error } = await supabaseAdmin().from('discussions').select('id').limit(1);
    dbError = error ? { code: error.code, message: error.message } : null;
    dbOk = !error;
  } catch (e) {
    dbError = { thrown: e instanceof Error ? e.message : String(e) };
  }

  return Response.json({ proc, cf, dbOk, dbError });
}
