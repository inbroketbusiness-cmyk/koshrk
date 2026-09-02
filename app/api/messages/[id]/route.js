import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import Message from '@/models/Message';
import { getSessionUserId } from '@/lib/auth';

// PATCH /api/messages/:id -> { text }  (only your own text messages, mirrors auth.php's ownership check)
export async function PATCH(req, { params }) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const { text } = await req.json();
  const trimmed = (text || '').trim();
  if (!trimmed) {
    return NextResponse.json({ ok: false, error: 'Message is empty.' }, { status: 422 });
  }

  const message = await Message.findById(params.id);
  if (!message || String(message.senderId) !== String(uid) || message.isImage) {
    return NextResponse.json({ ok: false, error: 'Cannot edit this message.' }, { status: 403 });
  }

  message.text = trimmed;
  message.isEdited = true;
  await message.save();

  return NextResponse.json({ ok: true, message });
}

// DELETE /api/messages/:id -> soft-delete (only your own message, text or image).
// We keep the document (so polling clients still see it go by) but blank out
// the content and flip isDeleted, same idea as WhatsApp's "this message was
// deleted" placeholder.
export async function DELETE(req, { params }) {
  await connectDB();
  const uid = getSessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const message = await Message.findById(params.id);
  if (!message || String(message.senderId) !== String(uid)) {
    return NextResponse.json({ ok: false, error: 'Cannot delete this message.' }, { status: 403 });
  }

  message.isDeleted = true;
  message.text = null;
  message.imagePath = null;
  message.isImage = false;
  await message.save();

  return NextResponse.json({ ok: true, message });
}
