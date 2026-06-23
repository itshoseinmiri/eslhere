import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    const existing = await db.student.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }
    await db.student.delete({ where: { id } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
