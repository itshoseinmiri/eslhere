import { readJsonFile, writeJsonFile } from '@/lib/data';

interface ClassRecord {
  id: string;
  date: string;
  duration: number;
  status: string;
}

interface AvailabilitySlot {
  date: string;
  start: string;
  end: string;
}

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
}

// GET — return all booked time windows (for the calendar to mark unavailable slots)
export async function GET() {
  try {
    const classes = readJsonFile<ClassRecord[]>('classes.json', []);
    const bookings = readJsonFile<BookingRequest[]>('bookings.json', []);
    const availability = readJsonFile<AvailabilitySlot[]>('availability.json', []);

    const blocked = [
      ...classes
        .filter(c => c.status !== 'canceled')
        .map(c => ({ start: c.date, duration: c.duration })),
      ...bookings
        .filter(b => b.status !== 'canceled')
        .map(b => ({ start: b.date, duration: b.duration })),
    ];

    return Response.json({ blocked, availability });
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

    const classes = readJsonFile<ClassRecord[]>('classes.json', []);
    const bookings = readJsonFile<BookingRequest[]>('bookings.json', []);

    // Overlap check against existing sessions and pending bookings
    const newStart = new Date(date).getTime();
    const newEnd = newStart + Number(duration) * 60_000;

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
        { error: 'This time slot is already booked. Please choose a different time.' },
        { status: 409 }
      );
    }

    // Don't allow booking in the past
    if (newStart < Date.now()) {
      return Response.json({ error: 'Cannot book a session in the past.' }, { status: 400 });
    }

    const existingIds = bookings.map(b => {
      const m = b.id.match(/^bkg(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const nextNum = Math.max(0, ...existingIds) + 1;
    const newId = `bkg${String(nextNum).padStart(3, '0')}`;

    const newBooking: BookingRequest = {
      id: newId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      ...(phone ? { phone: phone.trim() } : {}),
      topic: topic.trim(),
      ...(notes ? { notes: notes.trim() } : {}),
      date,
      duration: Number(duration),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    bookings.push(newBooking);
    writeJsonFile('bookings.json', bookings);

    return Response.json(newBooking, { status: 201 });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
