import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { createSessionCookie } from '@/lib/auth';

// action: "pin" -> { username, pin }
// action: "face" -> { descriptor: [128 floats] }
export async function POST(req) {
  await connectDB();
  const body = await req.json();

  if (body.action === 'face') {
    const descriptor = body.descriptor;
    if (!Array.isArray(descriptor) || descriptor.length < 64) {
      return NextResponse.json({ ok: false, error: 'Face not captured clearly. Try again.' }, { status: 422 });
    }

    const candidates = await User.find({ faceData: { $ne: null } });
    let best = null;
    let bestDistance = Infinity;

    for (const user of candidates) {
      const stored = user.faceData;
      if (!stored || stored.length !== descriptor.length) continue;
      let sumSq = 0;
      for (let i = 0; i < stored.length; i++) {
        const diff = stored[i] - descriptor[i];
        sumSq += diff * diff;
      }
      const distance = Math.sqrt(sumSq);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = user;
      }
    }

    // face-api.js typical match threshold ~0.6 Euclidean distance.
    if (!best || bestDistance > 0.6) {
      return NextResponse.json({ ok: false, error: 'Face not recognised. Use your PIN instead.' }, { status: 401 });
    }

    best.isOnline = true;
    best.lastSeen = new Date();
    await best.save();
    createSessionCookie(best._id);
    return NextResponse.json({ ok: true, redirect: '/chat' });
  }

  // Default: PIN login
  const username = (body.username || '').trim();
  const pin = (body.pin || '').trim();
  const user = await User.findOne({ username });

  if (!user || !(await bcrypt.compare(pin, user.pinHash))) {
    return NextResponse.json({ ok: false, error: 'Wrong name or PIN. Try again, jaan.' }, { status: 401 });
  }

  user.isOnline = true;
  user.lastSeen = new Date();
  await user.save();
  createSessionCookie(user._id);
  return NextResponse.json({ ok: true, redirect: '/chat' });
}
