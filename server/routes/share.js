import express from "express";
import Thread from "../models/Thread.js";

const router = express.Router();

router.get("/share/:shareId", async (req, res) => {
  try {
    const t = await Thread.findOne({ shareId: req.params.shareId }, "title messages");
    if (!t) return res.status(404).json({ error: "Shared chat not found" });
    res.json({ title: t.title, messages: t.messages });
  } catch (err) {
    res.status(500).json({ error: "Failed to load shared chat" });
  }
});

export default router;