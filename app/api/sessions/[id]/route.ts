import { verifyToken } from '@/lib/auth';
import { readJsonFile, writeJsonFile } from '@/lib/data';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  englishLevel: string;
  type: string;
  addedAt?: string;
}

interface ClassRecord {
  id: string;
  studentId: string;
  title: string;
  description?: string;
  date: string;
  duration: number;
  status: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const classes = readJsonFile<ClassRecord[]>('classes.json', []);
    const session = classes.find(c => c.id === id);

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const students = readJsonFile<Student[]>('students.json', []);
    const student = students.find(s => s.id === session.studentId) || null;

    const relatedSessions = classes
      .filter(c => c.studentId === session.studentId && c.id !== session.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);

    return Response.json({
      session,
      student,
      relatedSessions,
    });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { status } = await request.json();
    if (!['scheduled', 'completed', 'canceled'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    const classes = readJsonFile<ClassRecord[]>('classes.json', []);
    const idx = classes.findIndex(c => c.id === id);
    if (idx === -1) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    classes[idx] = { ...classes[idx], status };
    writeJsonFile('classes.json', classes);

    return Response.json(classes[idx]);
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
