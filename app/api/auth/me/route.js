import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


const ONLINE_WINDOW_MS = 8000;

function isOnline(user) {
  if (!user.isOnline) return false;
  return Date.now() - new Date(user.lastSeen).getTime() <= ONLINE_WINDOW_MS;
}

// Called on load + every poll tick: refreshes "last seen" and returns both
// the logged-in user and their partner (this app is always exactly 2 users).
export async function GET() {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  await User.findByIdAndUpdate(uid, { isOnline: true, lastSeen: new Date() });

  const me = await User.findById(uid);
  const partner = await User.findOne({ _id: { $ne: uid } });

  if (!me) {
    return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    me: { id: me._id, username: me.username, avatarPath: me.avatarPath, lastSeen: me.lastSeen },
    partner: partner
      ? {
          id: partner._id,
          username: partner.username,
          avatarPath: partner.avatarPath,
          online: isOnline(partner),
          lastSeen: partner.lastSeen,
        }
      : null,
  });
}
