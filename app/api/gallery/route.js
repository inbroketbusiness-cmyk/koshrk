import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import { getSessionUserId } from '@/lib/auth';

export async function GET() {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const images = await Message.find({ isImage: true }).sort({ createdAt: -1 });
  return NextResponse.json({ ok: true, images });
}
