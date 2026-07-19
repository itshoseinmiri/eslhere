// Service-role Supabase client — bypasses Row Level Security. SERVER ONLY.
// NEVER import this into a Client Component or anything that ships to the browser;
// the service role key is a full-access secret. Use it exclusively in Route
// Handlers that already gate on verifyToken() (see lib/auth.ts), plus the public
// read-only discussions GET.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";

let _admin: SupabaseClient | null = null;

// Resolve a runtime var. On Cloudflare/OpenNext, secrets live on the Worker's
// `env` binding (getCloudflareContext) and are not guaranteed to be mirrored to
// process.env; NEXT_PUBLIC_* values are inlined at build time and only show up on
// process.env. Check both. In `next dev` getCloudflareContext throws — fall back.
function readEnv(name: string): string | undefined {
  try {
    const v = (getCloudflareContext().env as Record<string, unknown>)[name];
    if (typeof v === "string" && v.length > 0) return v;
  } catch {
    /* not in a Cloudflare worker context (e.g. local dev) */
  }
  return process.env[name];
}

export function supabaseAdmin(): SupabaseClient {
  const url = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
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
