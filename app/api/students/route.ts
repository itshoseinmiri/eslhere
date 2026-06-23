import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeStudent } from '@/lib/serialize';

export async function GET(request: Request) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const students = await db.student.findMany({ orderBy: { addedAt: 'asc' } });
    return Response.json(students.map(serializeStudent));
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
    const required = ['firstName', 'lastName', 'email', 'phone', 'englishLevel', 'type'];
    for (const field of required) {
      if (!body[field]) {
        return Response.json({ error: `Missing field: ${field}` }, { status: 400 });
      }
    }
    const created = await db.student.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        englishLevel: body.englishLevel,
        type: body.type,
      },
    });
    return Response.json({ success: true, student: serializeStudent(created) });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
