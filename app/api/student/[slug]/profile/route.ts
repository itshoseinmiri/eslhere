import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeStudent, serializeClass, serializePayment, serializeDebt } from '@/lib/serialize';

function slugOf(firstName: string, lastName: string) {
  return (firstName.trim() + '_' + lastName.trim()).toLowerCase().replace(/\s+/g, '_');
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  try {
    const students = await db.student.findMany();
    const student = students.find((s) => slugOf(s.firstName, s.lastName) === decodedSlug);

    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const [classes, debts, payments] = await Promise.all([
      db.class.findMany({ where: { studentId: student.id } }),
      db.debt.findMany({ where: { studentId: student.id } }),
      db.payment.findMany({ where: { studentId: student.id } }),
    ]);

    const now = new Date();
    const studentClasses = classes.map(serializeClass);
    const upcoming = studentClasses
      .filter((c) => new Date(c.date) >= now && c.status !== 'canceled')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const past = studentClasses
      .filter((c) => new Date(c.date) < now || c.status === 'canceled')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return Response.json({
      student: serializeStudent(student),
      classes: { upcoming, past, all: studentClasses },
      payments: payments.map(serializePayment),
      debts: debts.map(serializeDebt),
    });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
