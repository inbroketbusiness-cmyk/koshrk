import mongoose from 'mongoose';

// Replaces the PHP version's signals.json file. Short-lived WebRTC
// offer/answer/ICE-candidate messages, relayed between the two users via
// polling. TTL index auto-deletes anything older than 2 minutes so this
// collection never grows.
const SignalSchema = new mongoose.Schema({
  toUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true }, // 'offer' | 'answer' | 'candidate' | 'hangup'
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now, expires: 120 },
});

export default mongoose.models.Signal || mongoose.model('Signal', SignalSchema);
