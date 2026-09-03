import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


// Every voice note either partner has ever sent (that hasn't been deleted),
// newest first — shown in Settings so both people can find old ones again.
export async function GET() {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const notes = await Message.find({ isVoice: true, isDeleted: false }).sort({ createdAt: -1 });
  return NextResponse.json({ ok: true, notes });
}
