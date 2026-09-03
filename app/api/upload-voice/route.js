import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Voice notes go up as Cloudinary "video" resources (Cloudinary treats
// audio-only files as a video resource type with no video track) — kept in
// the same 'ritikomal-love' folder, permanently, same as photos. Both
// partners' voice notes are stored the same way, so Settings -> Voice Notes
// can list everyone's clips.
export async function POST(req) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'Voice note storage not configured yet (missing Cloudinary env vars).' },
      { status: 500 }
    );
  }

  const form = await req.formData();
  const file = form.get('audio');
  const seconds = Number(form.get('seconds') || 0);
  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, error: 'No voice note provided.' }, { status: 422 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'ritikomal-love/voice-notes', resource_type: 'video' },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(buffer);
    });

    const message = await Message.create({
      senderId: uid,
      isVoice: true,
      voicePath: uploaded.secure_url,
      voiceSeconds: Math.round(seconds) || Math.round(uploaded.duration || 0),
    });
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message || 'Voice note upload failed.' }, { status: 500 });
  }
}
