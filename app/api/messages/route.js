import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


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

// Only Instagram Reel links are accepted for the "Send a Reel" button —
// this keeps it to a plain link-share (opens in a new tab / the Instagram
// app), never an embedded/loaded Instagram page inside the chat.
const REEL_URL_RE = /^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[A-Za-z0-9_-]+\/?/i;

// POST /api/messages  -> { text } OR { reelUrl } (image/voice sends go through their own routes)
export async function POST(req) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = await req.json();

  if (body.reelUrl) {
    const url = String(body.reelUrl).trim();
    if (!REEL_URL_RE.test(url)) {
      return NextResponse.json(
        { ok: false, error: 'Paste a valid Instagram Reel/post link (https://instagram.com/reel/...).' },
        { status: 422 }
      );
    }
    const message = await Message.create({ senderId: uid, isReel: true, reelUrl: url });
    return NextResponse.json({ ok: true, message });
  }

  const trimmed = (body.text || '').trim();
  if (!trimmed) {
    return NextResponse.json({ ok: false, error: 'Message is empty.' }, { status: 422 });
  }

  const message = await Message.create({ senderId: uid, text: trimmed });
  return NextResponse.json({ ok: true, message });
}
