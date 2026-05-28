import { randomBytes } from 'crypto';
import { verifyToken } from '@/lib/auth';
import { readJsonFile, writeJsonFile } from '@/lib/data';

export async function GET(request: Request) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const students = readJsonFile<Record<string, unknown>[]>('students.json', []);
    return Response.json(students.filter(s => s.id && s.firstName));
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const student = await request.json();
    const required = ['firstName', 'lastName', 'email', 'phone', 'englishLevel', 'type'];
    for (const field of required) {
      if (!student[field]) {
        return Response.json({ error: `Missing field: ${field}` }, { status: 400 });
      }
    }
    student.id = randomBytes(8).toString('hex');
    student.addedAt = new Date().toISOString();
    const students = readJsonFile<Record<string, unknown>[]>('students.json', []).filter(s => s.id && s.firstName);
    students.push(student);
    writeJsonFile('students.json', students);
    return Response.json({ success: true, student });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
