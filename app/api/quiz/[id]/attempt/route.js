import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Quiz from '@/models/Quiz';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


// POST /api/quiz/:id/attempt -> { answers: [selectedIndex, ...] }
// Scores server-side: 1 point per correct answer, 0 for a wrong one — and
// returns which of your answers were right/wrong so the UI can show a
// green/red result per question, plus the final score.
export async function POST(req, { params }) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const quiz = await Quiz.findById(params.id);
  if (!quiz) return NextResponse.json({ ok: false, error: 'Quiz not found.' }, { status: 404 });

  if (quiz.attempts.some((a) => String(a.userId) === String(uid))) {
    return NextResponse.json({ ok: false, error: "You've already solved this quiz today." }, { status: 409 });
  }

  const { answers } = await req.json();
  if (!Array.isArray(answers) || answers.length !== quiz.questions.length) {
    return NextResponse.json({ ok: false, error: 'Answer every question first.' }, { status: 422 });
  }

  let score = 0;
  const results = quiz.questions.map((q, i) => {
    const correct = Number(answers[i]) === q.correctIndex;
    if (correct) score += 1;
    return { correct, correctIndex: q.correctIndex };
  });

  quiz.attempts.push({ userId: uid, score, total: quiz.questions.length, answers, completedAt: new Date() });
  await quiz.save();

  return NextResponse.json({ ok: true, score, total: quiz.questions.length, results });
}
