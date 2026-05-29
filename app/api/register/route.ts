import { readJsonFile, writeJsonFile } from '@/lib/data';

export async function POST(request: Request) {
  try {
    const user = await request.json();
    const required = user.type === 'discussion'
      ? ['firstName', 'lastName', 'email', 'phone', 'englishLevel']
      : ['firstName', 'lastName', 'age', 'job', 'email', 'phone', 'englishLevel'];
    for (const field of required) {
      if (!user[field] && user[field] !== 0) {
        return Response.json({ error: `Missing field: ${field}` }, { status: 400 });
      }
    }
    const users = readJsonFile<Record<string, unknown>[]>('users.json', []).filter(u => u.firstName && u.email);
    users.push(user);
    writeJsonFile('users.json', users);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
