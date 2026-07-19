// Server-side Supabase client for Server Components, Route Handlers, and Server
// Functions. `cookies()` is ASYNC in this Next.js (v15+), so this factory is
// async too — always `await createClient()`.
//
// The setAll() try/catch is required: writing cookies from a Server Component
// render throws, and that is fine because proxy.ts refreshes the session on every
// request. Route Handlers / Server Functions CAN write, so the writes land there.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — ignore; proxy.ts handles refresh.
          }
        },
      },
    },
  );
}
