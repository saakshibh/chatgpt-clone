import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ["user", "model"], required: true },
  content: { type: String, required: true },
  attachments: [{ name: String, mimeType: String }],
  createdAt: { type: Date, default: Date.now },
});

const threadSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true },
    threadId: { type: String, required: true, unique: true },
    title: { type: String, default: "New Chat" },
    mode: { type: String, enum: ["chat", "codex"], default: "chat" },
    pinned: { type: Boolean, default: false },
    archived: { type: Boolean, default: false },
    projectId: { type: String, default: null, index: true },
    shareId: { type: String, default: null, index: true },
    messages: [messageSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Thread", threadSchema);