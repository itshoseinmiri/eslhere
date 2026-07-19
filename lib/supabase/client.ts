// Browser (Client Component) Supabase client. Reads the public env vars that
// Next.js inlines at build time (see .env / .env.example). Safe to call on every
// render — createBrowserClient memoizes a singleton internally.
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
