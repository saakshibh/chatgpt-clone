import mongoose from "mongoose";
import User from "./User.js";

const settingsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  displayName: { type: String, default: "User", maxlength: 40 },
  aboutYou: { type: String, default: "", maxlength: 1000 },
  customInstructions: { type: String, default: "", maxlength: 1500 },
  personalizationOn: { type: Boolean, default: true },
});

const Settings = mongoose.model("UserSettings", settingsSchema);
export default Settings;

// Returns this user's settings, creating them on first use
export async function getSettings(userId) {
  let s = await Settings.findOne({ userId });
  if (s) return s;
  const u = await User.findById(userId, "name");
  try {
    s = await Settings.create({ userId, displayName: u?.name || "User" });
  } catch {
    s = await Settings.findOne({ userId }); // created by a parallel request
  }
  return s;
}