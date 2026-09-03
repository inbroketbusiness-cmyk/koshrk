import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getSessionUserId, clearSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';


export async function POST() {
  await connectDB();
  const uid = getSessionUserId();
  if (uid) {
    await User.findByIdAndUpdate(uid, { isOnline: false });
  }
  clearSessionCookie();
  return NextResponse.json({ ok: true, redirect: '/' });
}
