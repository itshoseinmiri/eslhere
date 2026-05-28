import { verifyToken } from '@/lib/auth';
import { readJsonFile } from '@/lib/data';

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  [key: string]: unknown;
}

interface ClassRecord {
  studentId: string;
  date: string;
  status: string;
  [key: string]: unknown;
}

interface Payment {
  studentId: string;
  [key: string]: unknown;
}

interface Debt {
  studentId: string;
  [key: string]: unknown;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  try {
    const students = readJsonFile<Student[]>('students.json', []).filter(s => s.id && s.firstName);
    const student = students.find(s => {
      const sSlug = (s.firstName.trim() + '_' + s.lastName.trim()).toLowerCase().replace(/\s+/g, '_');
      return sSlug === decodedSlug;
    });

    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const allClasses = readJsonFile<ClassRecord[]>('classes.json', []).filter(c => c.studentId);
    const allDebts = readJsonFile<Debt[]>('debts.json', []).filter(d => d.studentId);
    const allPayments = readJsonFile<Payment[]>('payments.json', []).filter(p => p.studentId);

    const studentClasses = allClasses.filter(c => c.studentId === student.id);
    const studentDebts = allDebts.filter(d => d.studentId === student.id);
    const studentPayments = allPayments.filter(p => p.studentId === student.id);

    const now = new Date();
    const upcoming = studentClasses
      .filter(c => new Date(c.date) >= now && c.status !== 'canceled')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const past = studentClasses
      .filter(c => new Date(c.date) < now || c.status === 'canceled')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return Response.json({
      student,
      classes: { upcoming, past, all: studentClasses },
      payments: studentPayments,
      debts: studentDebts,
    });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
