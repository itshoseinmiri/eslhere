import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeRegistration } from '@/lib/serialize';

export async function GET(request: Request) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const registrations = await db.registration.findMany({ orderBy: { registeredAt: 'asc' } });
    return Response.json(registrations.map(serializeRegistration));
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
