// Root Proxy (this Next.js renamed `middleware` -> `proxy`; the exported function
// must be named `proxy`). Runs Supabase session refresh on page requests.
//
// The matcher excludes /api (the app's custom admin-token auth lives there and
// must not be touched), Next internals, and static assets.
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
