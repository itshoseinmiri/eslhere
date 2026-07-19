// Lists Supabase Auth users (admin login accounts) for the Admins page.
import { verifyToken } from '@/lib/auth';
import { listAuthUsers } from '@/lib/supabase/queries';

export async function GET(request: Request) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return Response.json(await listAuthUsers());
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
