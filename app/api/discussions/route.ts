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
    const { topic, date, time, dates, level, description, spots, duration, points, status, participants, thumbnail, reviews } = body;

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
      points: Array.isArray(points) ? points : [],
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
