import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


// Attach/replace the logged-in user's face descriptor (Settings -> Face ID).
export async function POST(req) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }
  const { descriptor } = await req.json();
  if (!Array.isArray(descriptor)) {
    return NextResponse.json({ ok: false, error: 'Invalid face data.' }, { status: 422 });
  }
  await User.findByIdAndUpdate(uid, { faceData: descriptor });
  return NextResponse.json({ ok: true });
}
