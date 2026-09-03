import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Quiz from '@/models/Quiz';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


// GET /api/quiz/:id -> the quiz's questions/options WITHOUT correctIndex,
// so a peek at the network tab can't spoil the answers.
export async function GET(req, { params }) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const quiz = await Quiz.findById(params.id);
  if (!quiz) return NextResponse.json({ ok: false, error: 'Quiz not found.' }, { status: 404 });

  const myAttempt = quiz.attempts.find((a) => String(a.userId) === String(uid));

  return NextResponse.json({
    ok: true,
    quiz: {
      _id: quiz._id,
      title: quiz.title,
      questions: quiz.questions.map((q) => ({ _id: q._id, question: q.question, options: q.options })),
      alreadyAttempted: !!myAttempt,
      myScore: myAttempt ? { score: myAttempt.score, total: myAttempt.total } : null,
    },
  });
}
