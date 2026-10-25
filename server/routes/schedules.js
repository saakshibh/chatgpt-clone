import express from "express";
import mongoose from "mongoose";
import Schedule from "../models/Schedule.js";
import { runSchedule } from "../utils/scheduler.js";

const router = express.Router();
const MAX_SCHEDULES = 10; // per user, protects your free Gemini quota
const validId = (id) => mongoose.isValidObjectId(id);

const validTz = (tz) => {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

router.get("/schedules", async (req, res) => {
  try {
    res.json(await Schedule.find({ userId: req.userId }).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(500).json({ error: "Failed to load schedules" });
  }
});

router.post("/schedules", async (req, res) => {
  const b = req.body;
  const prompt = String(b.prompt || "").trim().slice(0, 2000);
  if (!prompt) return res.status(400).json({ error: "Prompt is required" });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time || ""))
    return res.status(400).json({ error: "Time must be HH:MM" });

  try {
    if ((await Schedule.countDocuments({ userId: req.userId })) >= MAX_SCHEDULES)
      return res.status(400).json({ error: `Maximum ${MAX_SCHEDULES} scheduled tasks` });

    const s = await Schedule.create({
      userId: req.userId,
      name: String(b.name || "").trim().slice(0, 60) || prompt.slice(0, 40),
      prompt,
      frequency: b.frequency === "weekly" ? "weekly" : "daily",
      time: b.time,
      dayOfWeek:
        Number.isInteger(b.dayOfWeek) && b.dayOfWeek >= 0 && b.dayOfWeek <= 6
          ? b.dayOfWeek
          : 1,
      timezone: validTz(b.timezone) ? b.timezone : "Asia/Kolkata",
      webSearch: b.webSearch === true,
    });
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: "Failed to create schedule" });
  }
});

// Enable / pause
router.patch("/schedules/:id", async (req, res) => {
  if (typeof req.body.enabled !== "boolean")
    return res.status(400).json({ error: "enabled must be true or false" });
  if (!validId(req.params.id)) return res.status(404).json({ error: "Not found" });
  try {
    const s = await Schedule.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { enabled: req.body.enabled }
    );
    if (!s) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update schedule" });
  }
});

router.delete("/schedules/:id", async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: "Not found" });
  try {
    const s = await Schedule.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!s) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete schedule" });
  }
});

// Run now (waits for the result)
router.post("/schedules/:id/run", async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: "Not found" });
  try {
    const s = await Schedule.findOne({ _id: req.params.id, userId: req.userId });
    if (!s) return res.status(404).json({ error: "Not found" });
    const run = await runSchedule(s);
    res.json({ run });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Run failed" });
  }
});

export default router;