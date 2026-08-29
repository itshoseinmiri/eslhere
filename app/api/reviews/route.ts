import { verifyToken } from '@/lib/auth';
import {
  createTeacherReview,
  listTeacherReviews,
  listApprovedReviews,
} from '@/lib/supabase/queries';
import { serializeTeacherReview, jsonToReviewStatus } from '@/lib/serialize';
import type { ReviewStatus } from '@/lib/types';

// Public: only APPROVED reviews (homepage carousel).
// Admin (valid bearer token): all reviews, optionally filtered by ?status=.
export async function GET(request: Request) {
  try {
    if (await verifyToken(request)) {
      const statusParam = new URL(request.url).searchParams.get('status');
      const status: ReviewStatus | undefined = statusParam
        ? jsonToReviewStatus(statusParam)
        : undefined;
      const reviews = await listTeacherReviews(status);
      return Response.json(reviews.map(serializeTeacherReview));
    }
    const reviews = await listApprovedReviews();
    return Response.json(reviews.map(serializeTeacherReview));
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

// Public submit. New reviews land as PENDING and await admin approval.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const level = typeof body.level === 'string' ? body.level.trim() : '';
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const rating = Number(body.rating);

    if (!name || !level || !text) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return Response.json({ error: 'Rating must be between 1 and 5' }, { status: 400 });
    }

    await createTeacherReview({ name, level, rating, text });
    return Response.json({ success: true }, { status: 201 });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
