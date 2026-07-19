// Bearer tokens are stateless — the client discards the token from localStorage
// (see app/admin/layout.tsx) which is what ends the session. This endpoint stays
// for that call's contract; server-side JWT revocation would require the service
// role key and is out of scope for the single-admin setup.
export async function POST() {
  return Response.json({ success: true });
}
