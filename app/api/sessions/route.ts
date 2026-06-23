import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeClass, jsonToClassStatus } from '@/lib/serialize';

export async function GET(request: Request) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const classes = await db.class.findMany({
      include: { student: true },
      orderBy: { date: 'desc' },
    });

    const sessions = classes.map((c) => ({
      ...serializeClass(c),
      studentName: c.student ? `${c.student.firstName} ${c.student.lastName}` : 'Unknown',
      studentType: c.student?.type || 'private',
    }));

    return Response.json(sessions);
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { studentId, title, description, date, duration, status } = body;

    if (!studentId || !title || !date || !duration) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const student = await db.student.findUnique({ where: { id: studentId } });
    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    // Overlap check — reject if new session's window intersects any non-canceled session
    const newStart = new Date(date).getTime();
    const newEnd = newStart + Number(duration) * 60_000;
    const existing = await db.class.findMany({ where: { status: { not: 'CANCELED' } } });
    const overlap = existing.find((c) => {
      const existStart = c.date.getTime();
      const existEnd = existStart + c.duration * 60_000;
      return newStart < existEnd && newEnd > existStart;
    });
    if (overlap) {
      const od = overlap.date;
      const fmt = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      return Response.json(
        {
          error: 'overlap',
          message: `Time overlaps with "${overlap.title}" (${fmt(od)} – ${fmt(new Date(od.getTime() + overlap.duration * 60_000))})`,
        },
        { status: 409 }
      );
    }

    const created = await db.class.create({
      data: {
        studentId,
        title: String(title).trim(),
        ...(description ? { description: String(description).trim() } : {}),
        date: new Date(date),
        duration: Number(duration),
        status: status ? jsonToClassStatus(status) : 'SCHEDULED',
      },
    });

    return Response.json(serializeClass(created), { status: 201 });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
