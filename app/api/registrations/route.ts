import { verifyToken } from '@/lib/auth';
import { readJsonFile } from '@/lib/data';

export async function GET(request: Request) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const users = readJsonFile<Record<string, unknown>[]>('users.json', []);
    return Response.json(users.filter(u => u.firstName && u.email));
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
