import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: null },
  isImage: { type: Boolean, default: false },
  imagePath: { type: String, default: null },
  isEdited: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

MessageSchema.index({ createdAt: 1 });
MessageSchema.index({ isImage: 1 });

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
