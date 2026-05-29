import { verifyToken } from '@/lib/auth';
import { readJsonFile, writeJsonFile } from '@/lib/data';

interface Discussion {
  id: number;
  topic: string;
  date: string;
  time?: string;
  level: string;
  description: string;
  spots?: number;
  participants?: number;
  duration: string;
  points?: string[];
  status: string;
}

export async function GET() {
  try {
    const discussions = readJsonFile<Discussion[]>('discussions.json', []);
    return Response.json(discussions);
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { topic, date, time, level, description, spots, duration, points, status, participants } = body;

    if (!topic || !date || !level || !description || !duration) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const discussions = readJsonFile<Discussion[]>('discussions.json', []);

    const nextId = Math.max(0, ...discussions.map(d => d.id)) + 1;

    const newDiscussion: Discussion = {
      id: nextId,
      topic: topic.trim(),
      date,
      ...(time ? { time } : {}),
      level,
      description: description.trim(),
      ...(spots ? { spots: Number(spots) } : {}),
      ...(participants ? { participants: Number(participants) } : {}),
      duration,
      ...(points && points.length > 0 ? { points } : {}),
      status: status || 'upcoming',
    };

    discussions.push(newDiscussion);
    writeJsonFile('discussions.json', discussions);

    return Response.json(newDiscussion, { status: 201 });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
