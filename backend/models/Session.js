import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  host: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  tempHost: { type: String, required: false },
  connId: { type: String, required: false },
  createdAt: { type: Date, default: Date.now },
});

const Session = mongoose.model('Session', sessionSchema);
export default Session;
