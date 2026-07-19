// Session-refresh helper invoked from the root `proxy.ts` (this Next.js renamed
// the old `middleware` convention to `proxy`). It bridges request/response
// cookies so Supabase can rotate an expiring auth token on every request.
//
// Guarded: until NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are set to a real project,
// this is a pass-through no-op so the app keeps running with placeholder env.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return supabaseResponse; // not configured yet

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // IMPORTANT: getUser() refreshes the token. Do not add code between the client
  // creation above and this call, or you risk hard-to-debug session bugs.
  await supabase.auth.getUser();

  return supabaseResponse;
}
