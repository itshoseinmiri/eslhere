// Admin listing of registrations (leads). Renamed from /api/registrations.
// The underlying table stays `registrations`.
import { verifyToken } from '@/lib/auth';
import { listRegistrations } from '@/lib/supabase/queries';
import { serializeRegistration } from '@/lib/serialize';

export async function GET(request: Request) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const registrations = await listRegistrations();
    return Response.json(registrations.map(serializeRegistration));
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
