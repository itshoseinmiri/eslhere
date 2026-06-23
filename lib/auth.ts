import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { db } from '@/lib/db';

const ADMIN_ID = 'admin';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_HASH = createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

export function verifyPassword(pw: string): boolean {
  const hash = createHash('sha256').update(pw).digest('hex');
  return timingSafeEqual(Buffer.from(hash), Buffer.from(ADMIN_HASH));
}

export async function getAdminData(): Promise<{ access_token: string | null; expired_at: string | null }> {
  const admin = await db.adminSession.findUnique({ where: { id: ADMIN_ID } });
  return {
    access_token: admin?.accessToken ?? null,
    expired_at: admin?.expiredAt ? admin.expiredAt.toISOString() : null,
  };
}

export async function saveAdminData(data: { access_token: string | null; expired_at: string | null }) {
  const accessToken = data.access_token;
  const expiredAt = data.expired_at ? new Date(data.expired_at) : null;
  await db.adminSession.upsert({
    where: { id: ADMIN_ID },
    create: { id: ADMIN_ID, accessToken, expiredAt },
    update: { accessToken, expiredAt },
  });
}

export async function verifyToken(request: Request): Promise<boolean> {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const admin = await getAdminData();
  if (!admin.access_token || admin.access_token !== token) return false;
  if (!admin.expired_at || new Date(admin.expired_at).getTime() < Date.now()) {
    await saveAdminData({ access_token: null, expired_at: null });
    return false;
  }
  return true;
}

export function generateToken(): { access_token: string; expired_at: string } {
  const access_token = randomBytes(32).toString('hex');
  const expired_at = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  return { access_token, expired_at };
}
