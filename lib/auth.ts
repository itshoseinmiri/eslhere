import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const DATA_DIR = join(process.cwd(), 'data');
const ADMIN_FILE = join(DATA_DIR, 'admin.json');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ADMIN_HASH = createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function verifyPassword(pw: string): boolean {
  const hash = createHash('sha256').update(pw).digest('hex');
  return timingSafeEqual(Buffer.from(hash), Buffer.from(ADMIN_HASH));
}

export function getAdminData(): { access_token: string | null; expired_at: string | null } {
  try {
    return JSON.parse(readFileSync(ADMIN_FILE, 'utf-8'));
  } catch {
    return { access_token: null, expired_at: null };
  }
}

export function saveAdminData(data: { access_token: string | null; expired_at: string | null }) {
  ensureDataDir();
  writeFileSync(ADMIN_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

export function verifyToken(request: Request): boolean {
  const auth = request.headers.get('authorization');
  if (!auth || !auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7);
  const admin = getAdminData();
  if (!admin.access_token || admin.access_token !== token) return false;
  if (!admin.expired_at || new Date(admin.expired_at).getTime() < Date.now()) {
    saveAdminData({ access_token: null, expired_at: null });
    return false;
  }
  return true;
}

export function generateToken(): { access_token: string; expired_at: string } {
  const access_token = randomBytes(32).toString('hex');
  const expired_at = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  return { access_token, expired_at };
}
