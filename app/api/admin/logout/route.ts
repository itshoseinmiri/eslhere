import { saveAdminData } from '@/lib/auth';

export async function POST() {
  saveAdminData({ access_token: null, expired_at: null });
  return Response.json({ success: true });
}
