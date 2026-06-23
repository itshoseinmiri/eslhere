import { db } from '@/lib/db';
import { jsonToRegistrationType } from '@/lib/serialize';

export async function POST(request: Request) {
  try {
    const user = await request.json();
    const required =
      user.type === 'discussion'
        ? ['firstName', 'lastName', 'email', 'phone', 'englishLevel']
        : ['firstName', 'lastName', 'age', 'job', 'email', 'phone', 'englishLevel'];
    for (const field of required) {
      if (!user[field] && user[field] !== 0) {
        return Response.json({ error: `Missing field: ${field}` }, { status: 400 });
      }
    }

    await db.registration.create({
      data: {
        type: jsonToRegistrationType(user.type),
        firstName: String(user.firstName),
        lastName: String(user.lastName),
        email: String(user.email),
        phone: String(user.phone),
        englishLevel: String(user.englishLevel),
        age: user.age != null ? String(user.age) : null,
        job: user.job != null ? String(user.job) : null,
        whyPrivate: user.whyPrivate != null ? String(user.whyPrivate) : null,
        purpose: user.purpose != null ? String(user.purpose) : null,
        whyGroup: user.whyGroup != null ? String(user.whyGroup) : null,
        topics: user.topics != null ? String(user.topics) : null,
        discussionId: typeof user.discussionId === 'number' ? user.discussionId : null,
        discussionTopic: user.discussionTopic != null ? String(user.discussionTopic) : null,
        priorExperience: user.priorExperience != null ? String(user.priorExperience) : null,
        goals: user.goals != null ? String(user.goals) : null,
      },
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Server error' }, { status: 500 });
  }
}
