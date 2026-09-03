import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Quiz from '@/models/Quiz';
import User from '@/models/User';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


// GET /api/quiz -> every quiz, newest first, with each user's score (if
// they've solved it) but never the correct answers themselves.
export async function GET() {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const users = await User.find({}, 'username');
  const nameOf = Object.fromEntries(users.map((u) => [String(u._id), u.username]));

  const quizzes = await Quiz.find({}).sort({ createdAt: -1 });
  const shaped = quizzes.map((q) => {
    const myAttempt = q.attempts.find((a) => String(a.userId) === String(uid));
    return {
      _id: q._id,
      title: q.title,
      createdAt: q.createdAt,
      creatorId: q.creatorId,
      creatorName: nameOf[String(q.creatorId)] || 'Someone',
      questionCount: q.questions.length,
      myScore: myAttempt ? { score: myAttempt.score, total: myAttempt.total } : null,
      attempts: q.attempts.map((a) => ({
        username: nameOf[String(a.userId)] || 'Someone',
        score: a.score,
        total: a.total,
        completedAt: a.completedAt,
      })),
    };
  });

  return NextResponse.json({ ok: true, quizzes: shaped });
}

// POST /api/quiz -> { title, questions: [{ question, options: [4 strings], correctIndex }] }
export async function POST(req) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { title, questions } = await req.json();
  const trimmedTitle = (title || '').trim() || "Today's Quiz";

  if (!Array.isArray(questions) || questions.length === 0) {
    return NextResponse.json({ ok: false, error: 'Add at least one question.' }, { status: 422 });
  }

  const clean = [];
  for (const q of questions) {
    const question = (q.question || '').trim();
    const options = Array.isArray(q.options) ? q.options.map((o) => (o || '').trim()) : [];
    const correctIndex = Number(q.correctIndex);
    if (!question || options.length < 2 || options.some((o) => !o)) {
      return NextResponse.json({ ok: false, error: 'Every question needs text and filled-in options.' }, { status: 422 });
    }
    if (!(correctIndex >= 0 && correctIndex < options.length)) {
      return NextResponse.json({ ok: false, error: 'Pick the right answer for every question.' }, { status: 422 });
    }
    clean.push({ question, options, correctIndex });
  }

  const quiz = await Quiz.create({ creatorId: uid, title: trimmedTitle, questions: clean, attempts: [] });
  return NextResponse.json({ ok: true, quiz });
}
