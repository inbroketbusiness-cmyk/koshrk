import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [String], required: true },
  correctIndex: { type: Number, required: true },
}, { _id: true });

const AttemptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  answers: { type: [Number], default: [] },
  completedAt: { type: Date, default: Date.now },
});

const QuizSchema = new mongoose.Schema({
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  questions: { type: [QuestionSchema], default: [] },
  attempts: { type: [AttemptSchema], default: [] },
}, { timestamps: { createdAt: 'createdAt', updatedAt: false } });

export default mongoose.models.Quiz || mongoose.model('Quiz', QuizSchema);
