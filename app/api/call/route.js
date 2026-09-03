import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Signal from '@/models/Signal';
import User from '@/models/User';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


// POST /api/call -> { type, payload }  (send a signal to your partner)
export async function POST(req) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const partner = await User.findOne({ _id: { $ne: uid } });
  if (!partner) return NextResponse.json({ ok: false, error: 'No partner yet.' }, { status: 404 });

  const { type, payload } = await req.json();
  await Signal.create({ toUserId: partner._id, fromUserId: uid, type, payload });
  return NextResponse.json({ ok: true });
}

// GET /api/call -> pending signals for you, then deletes them (like the
// old signals.json getSignals-and-clear behaviour).
export async function GET() {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const signals = await Signal.find({ toUserId: uid }).sort({ createdAt: 1 });
  const ids = signals.map((s) => s._id);
  if (ids.length) await Signal.deleteMany({ _id: { $in: ids } });

  return NextResponse.json({ ok: true, signals });
}
