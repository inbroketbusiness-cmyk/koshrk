import { NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';
import Photo from '@/models/Photo';
import { getSessionUserId } from '@/lib/auth';

export const dynamic = 'force-dynamic';


cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// POST /api/auth/avatar
// Either:
//   - multipart/form-data with an "image" file (uploads a brand new photo), or
//   - application/json { imagePath } picking one already in the Gallery.
export async function POST(req) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const { imagePath } = await req.json();
    if (!imagePath) return NextResponse.json({ ok: false, error: 'No photo selected.' }, { status: 422 });
    // Only allow picking a photo that's actually in the couple's own gallery.
    const owned = await Photo.findOne({ imagePath });
    if (!owned) return NextResponse.json({ ok: false, error: 'That photo is not in your gallery.' }, { status: 403 });
    await User.findByIdAndUpdate(uid, { avatarPath: imagePath });
    return NextResponse.json({ ok: true, avatarPath: imagePath });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return NextResponse.json({ ok: false, error: 'Image storage not configured yet.' }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get('image');
  if (!file || typeof file === 'string') {
    return NextResponse.json({ ok: false, error: 'No image provided.' }, { status: 422 });
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'ritikomal-love/avatars',
          resource_type: 'image',
          transformation: [{ width: 600, height: 600, crop: 'fill', gravity: 'face', quality: 'auto', fetch_format: 'auto' }],
        },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(buffer);
    });
    await User.findByIdAndUpdate(uid, { avatarPath: uploaded.secure_url });
    return NextResponse.json({ ok: true, avatarPath: uploaded.secure_url });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message || 'Upload failed.' }, { status: 500 });
  }
}
