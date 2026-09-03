import mongoose from 'mongoose';

// Every photo ever shared in chat gets a permanent copy here. The Gallery
// drawer and the Hero carousel both read from this collection instead of
// from Message, so deleting a chat message never removes it from the
// couple's memories — exactly like a phone's camera roll.
const PhotoSchema = new mongoose.Schema({
  uploaderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  imagePath: { type: String, required: true },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

PhotoSchema.index({ createdAt: -1 });

export default mongoose.models.Photo || mongoose.model('Photo', PhotoSchema);
