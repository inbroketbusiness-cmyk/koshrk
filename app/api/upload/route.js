import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import { getSessionUserId } from '@/lib/auth';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Uploads straight to Cloudinary (folder: ritikomal-love) — no local disk,
// no Vercel Blob. `quality: auto` + `fetch_format: auto` is what compresses
// the image on Cloudinary's side, and the 1600px cap keeps huge phone
// photos from bloating storage. Needs CLOUDINARY_CLOUD_NAME,
// CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET set — see .env.local.example.
export async function POST(req) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json(
      { ok: false, error: 'Image storage not configured yet (missing Cloudinary env vars).' },
      { status: 500 }
    );
  }

  const form = await req.formData();
  const file = form.get('image');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, error: 'No image provided.' }, { status: 422 });
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ ok: false, error: 'Unsupported image type.' }, { status: 422 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'ritikomal-love',
          resource_type: 'image',
          transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(buffer);
    });

    const message = await Message.create({ senderId: uid, isImage: true, imagePath: uploaded.secure_url });
    return NextResponse.json({ ok: true, message });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message || 'Upload failed.' }, { status: 500 });
  }
}
