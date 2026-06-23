import { Prisma } from '@prisma/client';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { serializeDiscussion, jsonToDiscussionStatus } from '@/lib/serialize';

const include = {
  dates: { orderBy: { id: 'asc' as const } },
  reviews: { orderBy: { id: 'asc' as const } },
};

interface DateEntry {
  date: string;
  time?: string;
}
interface ReviewEntry {
  name: string;
  level?: string;
  text: string;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const discussion = await db.discussion.findUnique({ where: { id: Number(id) }, include });
    if (!discussion) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(serializeDiscussion(discussion));
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const numId = Number(id);
    const existing = await db.discussion.findUnique({ where: { id: numId } });
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data: Prisma.DiscussionUpdateInput = {};

    if (body.topic !== undefined) data.topic = String(body.topic).trim();
    if (body.level !== undefined) data.level = body.level;
    if (body.description !== undefined) data.description = String(body.description).trim();
    if (body.duration !== undefined) data.duration = body.duration;
    if (body.spots !== undefined) data.spots = body.spots != null ? Number(body.spots) : null;
    if (body.participants !== undefined) data.participants = body.participants != null ? Number(body.participants) : null;
    if (body.thumbnail !== undefined) data.thumbnail = body.thumbnail || null;
    if (body.status !== undefined) data.status = jsonToDiscussionStatus(body.status);
    if (body.points !== undefined) data.points = Array.isArray(body.points) ? body.points : [];

    if (body.dates !== undefined || body.date !== undefined) {
      const entries: DateEntry[] =
        Array.isArray(body.dates) && body.dates.length > 0
          ? body.dates
          : body.date
            ? [{ date: body.date, time: body.time }]
            : [];
      data.dates = {
        deleteMany: {},
        create: entries.map((d) => ({ date: d.date, time: d.time ?? '' })),
      };
    }

    if (body.reviews !== undefined) {
      const reviews: ReviewEntry[] = Array.isArray(body.reviews) ? body.reviews : [];
      data.reviews = {
        deleteMany: {},
        create: reviews.map((r) => ({ name: r.name, level: r.level ?? '', text: r.text })),
      };
    }

    const updated = await db.discussion.update({ where: { id: numId }, data, include });
    return Response.json(serializeDiscussion(updated));
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const numId = Number(id);
    const existing = await db.discussion.findUnique({ where: { id: numId } });
    if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

    await db.discussion.delete({ where: { id: numId } });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
