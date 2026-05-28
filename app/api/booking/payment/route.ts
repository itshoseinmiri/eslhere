import { readJsonFile, writeJsonFile } from '@/lib/data';

interface BookingRequest {
  id: string;
  name: string;
  email: string;
  phone?: string;
  topic: string;
  notes?: string;
  date: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'canceled';
  createdAt: string;
  packageSize?: number;
  amount?: number;
}

interface ClassRecord {
  id: string;
  date: string;
  duration: number;
  status: string;
}

interface SessionInput {
  date: string;
  duration: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, topic, notes, sessions, amount, packageSize } = body as {
      name: string;
      email: string;
      phone?: string;
      topic: string;
      notes?: string;
      sessions: SessionInput[];
      amount: number;
      packageSize: number;
    };

    if (!name || !email || !topic || !sessions?.length || !amount) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const classes = readJsonFile<ClassRecord[]>('classes.json', []);
    const bookings = readJsonFile<BookingRequest[]>('bookings.json', []);

    // Check all sessions for overlaps
    for (const session of sessions) {
      const newStart = new Date(session.date).getTime();
      const newEnd = newStart + Number(session.duration) * 60_000;

      if (newStart < Date.now()) {
        return Response.json({ error: 'Cannot book a session in the past.' }, { status: 400 });
      }

      const allBlocked = [
        ...classes.filter(c => c.status !== 'canceled'),
        ...bookings.filter(b => b.status !== 'canceled'),
      ];

      const overlap = allBlocked.find(c => {
        const s = new Date(c.date).getTime();
        const e = s + c.duration * 60_000;
        return newStart < e && newEnd > s;
      });

      if (overlap) {
        return Response.json(
          { error: 'One or more time slots are already booked. Please choose different times.' },
          { status: 409 },
        );
      }
    }

    // Save all sessions as pending bookings
    const existingIds = bookings.map(b => {
      const m = b.id.match(/^bkg(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    let nextNum = Math.max(0, ...existingIds) + 1;

    for (const session of sessions) {
      const newId = `bkg${String(nextNum++).padStart(3, '0')}`;
      bookings.push({
        id: newId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(phone ? { phone: phone.trim() } : {}),
        topic: topic.trim(),
        ...(notes ? { notes: notes.trim() } : {}),
        date: session.date,
        duration: Number(session.duration),
        status: 'pending',
        createdAt: new Date().toISOString(),
        packageSize,
        amount,
      });
    }

    writeJsonFile('bookings.json', bookings);

    // TODO: Integrate with a real Shaparak payment gateway (e.g. ZarinPal, IDPay, etc.)
    // For now, construct a placeholder redirect URL
    const paymentUrl = `https://shaparak.ir/payment?amount=${amount}&ref=${nextNum}`;

    return Response.json({ paymentUrl }, { status: 200 });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
