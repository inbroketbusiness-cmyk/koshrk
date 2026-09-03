import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import CoupleSettings from '@/models/CoupleSettings';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


async function getSingleton() {
  let doc = await CoupleSettings.findOne({});
  if (!doc) doc = await CoupleSettings.create({ wallpaper: 'classic' });
  return doc;
}

// GET -> current shared wallpaper (both partners poll this so a theme
// change on one phone shows up on the other's screen too).
export async function GET() {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const doc = await getSingleton();
  return NextResponse.json({ ok: true, wallpaper: doc.wallpaper });
}

// POST -> { wallpaper } sets it for both of you.
export async function POST(req) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { wallpaper } = await req.json();
  if (!wallpaper) return NextResponse.json({ ok: false, error: 'No wallpaper given.' }, { status: 422 });

  const doc = await getSingleton();
  doc.wallpaper = wallpaper;
  doc.updatedBy = uid;
  await doc.save();
  return NextResponse.json({ ok: true, wallpaper: doc.wallpaper });
}
