import { verifyToken } from '@/lib/auth';
import { listDiscussions, createDiscussion } from '@/lib/supabase/queries';
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

export async function GET() {
  try {
    const discussions = await listDiscussions();
    return Response.json(discussions.map(serializeDiscussion));
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { topic, date, time, dates, level, description, spots, duration, points, status, participants, thumbnail, reviews, learn, requirements, curriculum } = body;

    if (!topic || (!date && (!dates || dates.length === 0)) || !level || !description || !duration) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const dateEntries: DateEntry[] =
      Array.isArray(dates) && dates.length > 0 ? dates : date ? [{ date, time }] : [];

    const created = await createDiscussion({
      topic: String(topic).trim(),
      level,
      description: String(description).trim(),
      duration,
      status: status ? jsonToDiscussionStatus(status) : 'UPCOMING',
      spots: spots != null ? Number(spots) : null,
      participants: participants != null ? Number(participants) : null,
      thumbnail: thumbnail || null,
      points: cleanList(points),
      learn: cleanList(learn),
      requirements: cleanList(requirements),
      curriculum: cleanModules(curriculum),
      dates: dateEntries.map((d) => ({ date: d.date, time: d.time ?? '' })),
      reviews: (Array.isArray(reviews) ? reviews : []).map((r: ReviewEntry) => ({
        name: r.name,
        level: r.level ?? '',
        text: r.text,
      })),
    });

    return Response.json(serializeDiscussion(created), { status: 201 });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
