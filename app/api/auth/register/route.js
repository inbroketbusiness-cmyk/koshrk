import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { createSessionCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';


export async function POST(req) {
  await connectDB();
  const body = await req.json();
  const username = (body.username || '').trim();
  const pin = (body.pin || '').trim();
  const descriptor = Array.isArray(body.descriptor) ? body.descriptor : null;

  if (!username || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: 'Enter a name and a 6-digit PIN.' }, { status: 422 });
  }

  // Private space for exactly two people, same as the PHP version.
  const count = await User.countDocuments();
  if (count >= 2) {
    return NextResponse.json(
      { ok: false, error: 'RITIKOMAL LOVE already has its two members. Please log in instead.' },
      { status: 403 }
    );
  }

  const exists = await User.findOne({ username });
  if (exists) {
    return NextResponse.json({ ok: false, error: 'That name is already taken.' }, { status: 409 });
  }

  const lower = username.toLowerCase();
  let avatarPath = '/img/avatar-default.jpg';
  if (lower.includes('rit')) avatarPath = '/img/avatar-ritik.jpg';
  else if (lower.includes('kom')) avatarPath = '/img/avatar-komal.jpg';

  const pinHash = await bcrypt.hash(pin, 10);
  const user = await User.create({
    username,
    pinHash,
    faceData: descriptor,
    avatarPath,
    isOnline: true,
    lastSeen: new Date(),
  });

  createSessionCookie(user._id);
  return NextResponse.json({ ok: true, redirect: '/chat', faceSaved: !!descriptor });
}
