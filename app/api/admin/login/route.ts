import { verifyPassword, generateToken, saveAdminData } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    if (!password || !verifyPassword(password)) {
      return Response.json({ error: 'Invalid password' }, { status: 401 });
    }
    const tokenData = generateToken();
    await saveAdminData(tokenData);
    return Response.json(tokenData);
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
