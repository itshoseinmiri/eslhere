import { verifyToken } from '@/lib/auth';
import { readJsonFile, writeJsonFile } from '@/lib/data';

interface Student {
  id: string;
  [key: string]: unknown;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  try {
    let students = readJsonFile<Student[]>('students.json', []).filter(s => s.id);
    const before = students.length;
    students = students.filter(s => s.id !== id);
    if (students.length === before) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }
    writeJsonFile('students.json', students);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
