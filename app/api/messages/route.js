import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import { getSessionUserId } from '@/lib/auth';

// GET /api/messages?after=<messageId>  -> messages newer than the given id
// (or the last 50 if `after` is omitted, for the initial load).
export async function GET(req) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const after = req.nextUrl.searchParams.get('after');
  let query = {};
  if (after) {
    const afterDoc = await Message.findById(after);
    if (afterDoc) query = { createdAt: { $gt: afterDoc.createdAt } };
  }

  const docs = await Message.find(query)
    .sort({ createdAt: after ? 1 : -1 })
    .limit(after ? 200 : 50);
  const messages = after ? docs : docs.reverse();

  return NextResponse.json({ ok: true, messages });
}

// POST /api/messages  -> { text }  (image sends go through /api/upload instead)
export async function POST(req) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { text } = await req.json();
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return NextResponse.json({ ok: false, error: 'Message is empty.' }, { status: 422 });
  }

  const message = await Message.create({ senderId: uid, text: trimmed });
  return NextResponse.json({ ok: true, message });
}
