import { verifyToken } from '@/lib/auth';
import { readJsonFile, writeJsonFile } from '@/lib/data';

interface Discussion {
  id: number;
  topic: string;
  date?: string;
  time?: string;
  dates?: { date: string; time?: string }[];
  level: string;
  description: string;
  spots?: number;
  participants?: number;
  duration: string;
  points?: string[];
  status: string;
  thumbnail?: string;
  reviews?: { name: string; level?: string; text: string }[];
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const numId = Number(id);
    const discussions = readJsonFile<Discussion[]>('discussions.json', []);
    const discussion = discussions.find(d => d.id === numId);
    if (!discussion) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(discussion);
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const numId = Number(id);
    const body = await request.json();
    const discussions = readJsonFile<Discussion[]>('discussions.json', []);
    const idx = discussions.findIndex(d => d.id === numId);
    if (idx === -1) return Response.json({ error: 'Not found' }, { status: 404 });

    const allowed = ['topic', 'date', 'time', 'dates', 'level', 'description', 'spots', 'participants', 'duration', 'points', 'status', 'thumbnail', 'reviews'];
    const entry = discussions[idx] as unknown as Record<string, unknown>;
    for (const key of allowed) {
      if (body[key] !== undefined) {
        entry[key] = body[key];
      }
    }

    writeJsonFile('discussions.json', discussions);
    return Response.json(discussions[idx]);
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyToken(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const numId = Number(id);
    const discussions = readJsonFile<Discussion[]>('discussions.json', []);
    const idx = discussions.findIndex(d => d.id === numId);
    if (idx === -1) return Response.json({ error: 'Not found' }, { status: 404 });

    discussions.splice(idx, 1);
    writeJsonFile('discussions.json', discussions);
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
