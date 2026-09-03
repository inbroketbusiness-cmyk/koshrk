import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


// POST /api/auth/change-password -> { currentPin, newPin }
export async function POST(req) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { currentPin, newPin } = await req.json();
  if (!/^\d{6}$/.test(String(newPin || ''))) {
    return NextResponse.json({ ok: false, error: 'New PIN must be exactly 6 digits.' }, { status: 422 });
  }

  const user = await User.findById(uid);
  if (!user || !(await bcrypt.compare(String(currentPin || ''), user.pinHash))) {
    return NextResponse.json({ ok: false, error: 'Current PIN is wrong.' }, { status: 401 });
  }

  user.pinHash = await bcrypt.hash(String(newPin), 10);
  await user.save();
  return NextResponse.json({ ok: true });
}
