import { signInAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    const session = await signInAdmin(email ?? '', password);
    if (!session) {
      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }
    return Response.json(session);
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
