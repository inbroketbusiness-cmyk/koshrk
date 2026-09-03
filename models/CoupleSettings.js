import mongoose from 'mongoose';

// Singleton document (there's only ever one row) holding settings that are
// shared between both partners — right now just the chat wallpaper, so
// picking a theme on one phone updates it for the other person too.
const CoupleSettingsSchema = new mongoose.Schema({
  wallpaper: { type: String, default: 'classic' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: false, updatedAt: 'updatedAt' } });

export default mongoose.models.CoupleSettings || mongoose.model('CoupleSettings', CoupleSettingsSchema);
