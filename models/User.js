import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  pinHash: { type: String, required: true },
  // JSON array of 128 floats from face-api.js, or null if Face ID not set up.
  faceData: { type: [Number], default: null },
  avatarPath: { type: String, default: '/img/avatar-default.jpg' },
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

export default mongoose.models.User || mongoose.model('User', UserSchema);
