import { verifyToken } from '@/lib/auth';
import { readJsonFile, writeJsonFile } from '@/lib/data';

interface AvailabilitySlot {
  date: string;
  start: string;
  end: string;
}

// GET — return all availability slots (admin-only)
export async function GET(request: Request) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const availability = readJsonFile<AvailabilitySlot[]>('availability.json', []);
    return Response.json(availability);
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST — add a new availability slot
export async function POST(request: Request) {
  if (!verifyToken(request)) {
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

    const availability = readJsonFile<AvailabilitySlot[]>('availability.json', []);

    // Check for overlapping availability on the same date
    const newStartMins = sH * 60 + sM;
    const newEndMins = eH * 60 + eM;
    const overlap = availability.find(a => {
      if (a.date !== date) return false;
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

    const newSlot: AvailabilitySlot = { date, start, end };
    availability.push(newSlot);

    // Sort by date then start time
    availability.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.start.localeCompare(b.start);
    });

    writeJsonFile('availability.json', availability);
    return Response.json(newSlot, { status: 201 });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE — remove an availability slot by date+start+end
export async function DELETE(request: Request) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { date, start, end } = body;

    if (!date || !start || !end) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const availability = readJsonFile<AvailabilitySlot[]>('availability.json', []);
    const idx = availability.findIndex(a => a.date === date && a.start === start && a.end === end);

    if (idx === -1) {
      return Response.json({ error: 'Availability slot not found' }, { status: 404 });
    }

    availability.splice(idx, 1);
    writeJsonFile('availability.json', availability);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
