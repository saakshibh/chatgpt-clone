
import mongoose from "mongoose";

const runSchema = new mongoose.Schema(
  {
    ranAt: { type: Date, default: Date.now },
    ok: Boolean,
    text: String,
    threadId: String,
  },
  { _id: true }
);

const scheduleSchema = new mongoose.Schema(
  {
    userId: { type: String, index: true },
    name: { type: String, required: true, maxlength: 60 },
    prompt: { type: String, required: true, maxlength: 2000 },
    frequency: { type: String, enum: ["daily", "weekly"], default: "daily" },
    time: { type: String, default: "09:00" }, // HH:MM, 24-hour
    dayOfWeek: { type: Number, min: 0, max: 6, default: 1 }, // 0 = Sunday
    timezone: { type: String, default: "Asia/Kolkata" },
    webSearch: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    lastRunKey: { type: String, default: "" },
    runs: [runSchema], // newest first, max 10
  },
  { timestamps: true }
);

export default mongoose.model("Schedule", scheduleSchema);