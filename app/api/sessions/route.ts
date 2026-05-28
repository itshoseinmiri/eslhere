import { verifyToken } from '@/lib/auth';
import { readJsonFile, writeJsonFile } from '@/lib/data';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  type: string;
  [key: string]: unknown;
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

export async function GET(request: Request) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const students = readJsonFile<Student[]>('students.json', []).filter(s => s.id && s.firstName);
    const classes = readJsonFile<ClassRecord[]>('classes.json', []).filter(c => c.studentId);

    const studentMap = new Map(students.map(s => [s.id, s]));

    const sessions = classes.map(c => {
      const student = studentMap.get(c.studentId);
      return {
        ...c,
        studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
        studentType: student?.type || 'private',
      };
    });

    sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return Response.json(sessions);
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { studentId, title, description, date, duration, status } = body;

    if (!studentId || !title || !date || !duration) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const students = readJsonFile<Student[]>('students.json', []);
    if (!students.some(s => s.id === studentId)) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const classes = readJsonFile<ClassRecord[]>('classes.json', []);

    // Overlap check — reject if new session's window intersects any non-canceled session
    const newStart = new Date(date).getTime();
    const newEnd = newStart + Number(duration) * 60_000;
    const overlap = classes.find(c => {
      if (c.status === 'canceled') return false;
      const existStart = new Date(c.date).getTime();
      const existEnd = existStart + c.duration * 60_000;
      return newStart < existEnd && newEnd > existStart;
    });
    if (overlap) {
      const od = new Date(overlap.date);
      const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return Response.json({
        error: 'overlap',
        message: `Time overlaps with "${overlap.title}" (${fmt(od)} – ${fmt(new Date(od.getTime() + overlap.duration * 60_000))})`,
      }, { status: 409 });
    }

    // Generate next ID based on existing IDs
    const existingIds = classes.map(c => {
      const match = c.id.match(/^cls(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const nextNum = Math.max(0, ...existingIds) + 1;
    const newId = `cls${String(nextNum).padStart(3, '0')}`;

    const newSession: ClassRecord = {
      id: newId,
      studentId,
      title: title.trim(),
      ...(description ? { description: description.trim() } : {}),
      date,
      duration: Number(duration),
      status: status || 'scheduled',
    };

    classes.push(newSession);
    writeJsonFile('classes.json', classes);

    return Response.json(newSession, { status: 201 });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
