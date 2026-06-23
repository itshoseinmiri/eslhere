import { db } from '@/lib/db';

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

    const [classes, bookings] = await Promise.all([
      db.class.findMany({ where: { status: { not: 'CANCELED' } } }),
      db.booking.findMany({ where: { status: { not: 'CANCELED' } } }),
    ]);

    const allBlocked = [
      ...classes.map((c) => ({ date: c.date, duration: c.duration })),
      ...bookings.map((b) => ({ date: b.date, duration: b.duration })),
    ];

    // Check all sessions for overlaps
    for (const session of sessions) {
      const newStart = new Date(session.date).getTime();
      const newEnd = newStart + Number(session.duration) * 60_000;

      if (newStart < Date.now()) {
        return Response.json({ error: 'Cannot book a session in the past.' }, { status: 400 });
      }

      const overlap = allBlocked.find((c) => {
        const s = c.date.getTime();
        const e = s + c.duration * 60_000;
        return newStart < e && newEnd > s;
      });

      if (overlap) {
        return Response.json(
          { error: 'One or more time slots are already booked. Please choose different times.' },
          { status: 409 }
        );
      }
    }

    // Save all sessions as pending bookings
    await db.booking.createMany({
      data: sessions.map((session) => ({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        ...(phone ? { phone: phone.trim() } : {}),
        topic: topic.trim(),
        ...(notes ? { notes: notes.trim() } : {}),
        date: new Date(session.date),
        duration: Number(session.duration),
        status: 'PENDING' as const,
        packageSize,
        amount,
      })),
    });

    // TODO: Integrate with a real Shaparak payment gateway (e.g. ZarinPal, IDPay, etc.)
    // For now, construct a placeholder redirect URL
    const paymentUrl = `https://shaparak.ir/payment?amount=${amount}&ref=${Date.now()}`;

    return Response.json({ paymentUrl }, { status: 200 });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
