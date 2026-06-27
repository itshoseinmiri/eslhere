import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import type { Availability } from '@/lib/types';

// GET — return all availability slots (admin-only)
export async function GET(request: Request) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const availability = await db.availability.findMany({
      orderBy: [{ date: 'asc' }, { start: 'asc' }],
    });
    return Response.json(availability.map((a: Availability) => ({ date: a.date, start: a.start, end: a.end })));
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST — add a new availability slot
export async function POST(request: Request) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { date, start, end } = body;

    if (!date || !start || !end) {
      return Response.json({ error: 'Missing required fields (date, start, end)' }, { status: 400 });
    }

    // Validate time format HH:MM
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(start) || !timeRegex.test(end)) {
      return Response.json({ error: 'Invalid time format. Use HH:MM' }, { status: 400 });
    }

    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    if (sH * 60 + sM >= eH * 60 + eM) {
      return Response.json({ error: 'End time must be after start time' }, { status: 400 });
    }

    // Check for overlapping availability on the same date
    const newStartMins = sH * 60 + sM;
    const newEndMins = eH * 60 + eM;
    const sameDate = await db.availability.findMany({ where: { date } });
    const overlap = sameDate.find((a: Availability) => {
      const [aH, aM] = a.start.split(':').map(Number);
      const [bH, bM] = a.end.split(':').map(Number);
      const aStart = aH * 60 + aM;
      const aEnd = bH * 60 + bM;
      return newStartMins < aEnd && newEndMins > aStart;
    });

    if (overlap) {
      return Response.json(
        { error: `Overlaps with existing availability on ${date} (${overlap.start} – ${overlap.end})` },
        { status: 409 }
      );
    }

    await db.availability.create({ data: { date, start, end } });
    return Response.json({ date, start, end }, { status: 201 });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE — remove an availability slot by date+start+end
export async function DELETE(request: Request) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { date, start, end } = body;

    if (!date || !start || !end) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const existing = await db.availability.findUnique({
      where: { date_start_end: { date, start, end } },
    });
    if (!existing) {
      return Response.json({ error: 'Availability slot not found' }, { status: 404 });
    }

    await db.availability.delete({ where: { date_start_end: { date, start, end } } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
