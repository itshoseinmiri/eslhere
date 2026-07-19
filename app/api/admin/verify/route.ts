import { verifyToken, bearerToken, tokenExpiry } from '@/lib/auth';

export async function GET(request: Request) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
  const token = bearerToken(request);
  return Response.json({ valid: true, expired_at: token ? tokenExpiry(token) : null });
}
