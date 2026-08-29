import { verifyToken } from '@/lib/auth';
import {
  getDiscussion,
  discussionExists,
  updateDiscussion,
  deleteDiscussion,
  type DiscussionPatch,
} from '@/lib/supabase/queries';
import { serializeDiscussion, jsonToDiscussionStatus } from '@/lib/serialize';

interface DateEntry {
  date: string;
  time?: string;
}
interface ReviewEntry {
  name: string;
  level?: string;
  text: string;
}
interface ModuleEntry {
  title: string;
  summary?: string;
  items?: string[];
}

// Trims a bullet list and drops the blank rows the admin form leaves behind.
function cleanList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];
}

// A module is only kept when it has a title — an empty accordion tab is noise.
function cleanModules(value: unknown): { title: string; summary: string; items: string[] }[] {
  return (Array.isArray(value) ? (value as ModuleEntry[]) : [])
    .map((m) => ({
      title: String(m?.title ?? '').trim(),
      summary: String(m?.summary ?? '').trim(),
      items: cleanList(m?.items),
    }))
    .filter((m) => m.title);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const discussion = await getDiscussion(Number(id));
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
    if (!(await discussionExists(numId))) return Response.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const patch: DiscussionPatch = {};

    if (body.topic !== undefined) patch.topic = String(body.topic).trim();
    if (body.level !== undefined) patch.level = body.level;
    if (body.description !== undefined) patch.description = String(body.description).trim();
    if (body.duration !== undefined) patch.duration = body.duration;
    if (body.spots !== undefined) patch.spots = body.spots != null ? Number(body.spots) : null;
    if (body.participants !== undefined) patch.participants = body.participants != null ? Number(body.participants) : null;
    if (body.thumbnail !== undefined) patch.thumbnail = body.thumbnail || null;
    if (body.status !== undefined) patch.status = jsonToDiscussionStatus(body.status);
    if (body.points !== undefined) patch.points = cleanList(body.points);
    if (body.learn !== undefined) patch.learn = cleanList(body.learn);
    if (body.requirements !== undefined) patch.requirements = cleanList(body.requirements);
    if (body.curriculum !== undefined) patch.curriculum = cleanModules(body.curriculum);

    if (body.dates !== undefined || body.date !== undefined) {
      const entries: DateEntry[] =
        Array.isArray(body.dates) && body.dates.length > 0
          ? body.dates
          : body.date
            ? [{ date: body.date, time: body.time }]
            : [];
      patch.dates = entries.map((d) => ({ date: d.date, time: d.time ?? '' }));
    }

    if (body.reviews !== undefined) {
      const reviews: ReviewEntry[] = Array.isArray(body.reviews) ? body.reviews : [];
      patch.reviews = reviews.map((r) => ({ name: r.name, level: r.level ?? '', text: r.text }));
    }

    const updated = await updateDiscussion(numId, patch);
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
    if (!(await discussionExists(numId))) return Response.json({ error: 'Not found' }, { status: 404 });

    await deleteDiscussion(numId);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
