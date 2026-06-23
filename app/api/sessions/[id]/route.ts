import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeClass, serializeStudent, jsonToClassStatus } from '@/lib/serialize';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const session = await db.class.findUnique({
      where: { id },
      include: { student: true },
    });

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const related = await db.class.findMany({
      where: { studentId: session.studentId, id: { not: session.id } },
      orderBy: { date: 'desc' },
      take: 5,
    });

    return Response.json({
      session: serializeClass(session),
      student: session.student ? serializeStudent(session.student) : null,
      relatedSessions: related.map(serializeClass),
    });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { status } = await request.json();
    if (!['scheduled', 'completed', 'canceled'].includes(status)) {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }

    const existing = await db.class.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const updated = await db.class.update({
      where: { id },
      data: { status: jsonToClassStatus(status) },
    });

    return Response.json(serializeClass(updated));
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
