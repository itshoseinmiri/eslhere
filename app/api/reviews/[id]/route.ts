import { verifyToken } from '@/lib/auth';
import { setReviewStatus, deleteTeacherReview } from '@/lib/supabase/queries';
import { jsonToReviewStatus } from '@/lib/serialize';

// Approve / unapprove a review.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.status !== 'approved' && body.status !== 'pending') {
      return Response.json({ error: 'Invalid status' }, { status: 400 });
    }
    const found = await setReviewStatus(id, jsonToReviewStatus(body.status));
    if (!found) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}

// Delete a review permanently.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyToken(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const found = await deleteTeacherReview(id);
    if (!found) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
