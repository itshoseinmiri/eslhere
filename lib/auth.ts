// Admin auth backed by Supabase Auth.
//
// The app keeps its existing transport: the browser stores a bearer token in
// localStorage and sends it as `Authorization: Bearer <jwt>`; every admin API
// route gates on verifyToken(). What changed is the credential — the token is
// now a Supabase access token (JWT) instead of a random string in the mock store.
//
// Single admin: the login form stays password-only. The email is fixed via the
// ADMIN_EMAIL env and paired with the typed password for signInWithPassword().
// Create that user (confirmed) in Supabase ▸ Authentication ▸ Users.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';

// Stateless client — never persists a session; we pass tokens explicitly.
let _client: SupabaseClient | null = null;
function authClient(): SupabaseClient {
  if (!_client) {
    _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}

function configured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

// Decode the `exp` claim (unix seconds) from a JWT WITHOUT verifying — used only
// to drive the admin session countdown. verifyToken() does the real validation.
export function tokenExpiry(token: string): string | null {
  try {
    const payload = token.split('.')[1];
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
    return json.exp ? new Date(json.exp * 1000).toISOString() : null;
  } catch {
    return null;
  }
}

// Sign an admin in with the submitted email + password. Falls back to the
// ADMIN_EMAIL env when no email is provided (password-only forms).
export async function signInAdmin(
  email: string,
  password: string,
): Promise<{ access_token: string; expired_at: string | null } | null> {
  const loginEmail = email || ADMIN_EMAIL;
  if (!configured() || !loginEmail || !password) return null;
  const { data, error } = await authClient().auth.signInWithPassword({
    email: loginEmail,
    password,
  });
  if (error || !data.session) return null;
  const access_token = data.session.access_token;
  return { access_token, expired_at: tokenExpiry(access_token) };
}

// Validate the bearer token against the Supabase Auth API. Returns false when
// missing, malformed, expired, or when auth is not yet configured.
export async function verifyToken(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return false;
  if (!configured()) return false;
  const token = auth.slice(7);
  const { data, error } = await authClient().auth.getUser(token);
  return !error && Boolean(data.user);
}

// Pull the bearer token off a request (for callers that need the raw JWT, e.g.
// to read its expiry after verifyToken() has already validated it).
export function bearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}
