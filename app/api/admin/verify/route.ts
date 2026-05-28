import { verifyToken, getAdminData } from '@/lib/auth';

export async function GET(request: Request) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
  const admin = getAdminData();
  return Response.json({ valid: true, expired_at: admin.expired_at });
}
