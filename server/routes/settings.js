import express from "express";
import Settings, { getSettings } from "../models/Settings.js";
import Thread from "../models/Thread.js";
import User from "../models/User.js";

const router = express.Router();

const publicFields = (s) => ({
  displayName: s.displayName,
  aboutYou: s.aboutYou,
  customInstructions: s.customInstructions,
  personalizationOn: s.personalizationOn,
});

router.get("/settings", async (req, res) => {
  try {
    res.json(publicFields(await getSettings(req.userId)));
  } catch (err) {
    res.status(500).json({ error: "Failed to load settings" });
  }
});

router.put("/settings", async (req, res) => {
  const b = req.body;
  const update = {};
  if (typeof b.displayName === "string" && b.displayName.trim())
    update.displayName = b.displayName.trim().slice(0, 40);
  if (typeof b.aboutYou === "string") update.aboutYou = b.aboutYou.slice(0, 1000);
  if (typeof b.customInstructions === "string")
    update.customInstructions = b.customInstructions.slice(0, 1500);
  if (typeof b.personalizationOn === "boolean")
    update.personalizationOn = b.personalizationOn;

  try {
    await getSettings(req.userId); // make sure the document exists
    const s = await Settings.findOneAndUpdate({ userId: req.userId }, update, {
      new: true,
    });
    if (update.displayName)
      await User.updateOne({ _id: req.userId }, { name: update.displayName });
    res.json(publicFields(s));
  } catch (err) {
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// Export every chat of this user
router.get("/export", async (req, res) => {
  try {
    const threads = await Thread.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
});

// Delete ALL chats of this user (projects are kept)
router.delete("/all-chats", async (req, res) => {
  try {
    await Thread.deleteMany({ userId: req.userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete chats" });
  }
});

export default router;