import { db } from '@/lib/db';
import { serializeBooking } from '@/lib/serialize';

// GET — return all booked time windows (for the calendar to mark unavailable slots)
export async function GET() {
  try {
    const [classes, bookings, availability] = await Promise.all([
      db.class.findMany({ where: { status: { not: 'CANCELED' } } }),
      db.booking.findMany({ where: { status: { not: 'CANCELED' } } }),
      db.availability.findMany({ orderBy: [{ date: 'asc' }, { start: 'asc' }] }),
    ]);

    const blocked = [
      ...classes.map((c) => ({ start: c.date.toISOString(), duration: c.duration })),
      ...bookings.map((b) => ({ start: b.date.toISOString(), duration: b.duration })),
    ];

    return Response.json({
      blocked,
      availability: availability.map((a) => ({ date: a.date, start: a.start, end: a.end })),
    });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST — submit a new booking request
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, phone, topic, notes, date, duration } = body;

    if (!name || !email || !topic || !date || !duration) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const newStart = new Date(date).getTime();
    const newEnd = newStart + Number(duration) * 60_000;

    // Don't allow booking in the past
    if (newStart < Date.now()) {
      return Response.json({ error: 'Cannot book a session in the past.' }, { status: 400 });
    }

    // Overlap check against existing sessions and pending bookings
    const [classes, bookings] = await Promise.all([
      db.class.findMany({ where: { status: { not: 'CANCELED' } } }),
      db.booking.findMany({ where: { status: { not: 'CANCELED' } } }),
    ]);

    const allBlocked = [
      ...classes.map((c) => ({ date: c.date, duration: c.duration })),
      ...bookings.map((b) => ({ date: b.date, duration: b.duration })),
    ];

    const overlap = allBlocked.find((c) => {
      const s = c.date.getTime();
      const e = s + c.duration * 60_000;
      return newStart < e && newEnd > s;
    });

    if (overlap) {
      return Response.json(
        { error: 'This time slot is already booked. Please choose a different time.' },
        { status: 409 }
      );
    }

    const created = await db.booking.create({
      data: {
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        ...(phone ? { phone: String(phone).trim() } : {}),
        topic: String(topic).trim(),
        ...(notes ? { notes: String(notes).trim() } : {}),
        date: new Date(date),
        duration: Number(duration),
        status: 'PENDING',
      },
    });

    return Response.json(serializeBooking(created), { status: 201 });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
