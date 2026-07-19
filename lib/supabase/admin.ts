// Service-role Supabase client — bypasses Row Level Security. SERVER ONLY.
// NEVER import this into a Client Component or anything that ships to the browser;
// the service role key is a full-access secret. Use it exclusively in Route
// Handlers that already gate on verifyToken() (see lib/auth.ts), plus the public
// read-only discussions GET.
//
// Env access MUST use literal `process.env.X` references (not a dynamic
// `process.env[name]`): Next inlines NEXT_PUBLIC_* only for literal reads, and
// OpenNext bridges the Worker's runtime secret onto process.env at request time.
// So on Cloudflare: NEXT_PUBLIC_SUPABASE_URL comes from the build-time inline,
// SUPABASE_SERVICE_ROLE_KEY from the runtime secret binding.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _admin: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin client not configured: set SUPABASE_SERVICE_ROLE_KEY (and NEXT_PUBLIC_SUPABASE_URL) in your environment.",
    );
  }
  if (!_admin) {
    _admin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}
