import express from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import Thread from "../models/Thread.js";
import {
  streamReply,
  generateTitle,
  buildSystemInstruction,
} from "../utils/gemini.js";
import { getSettings } from "../models/Settings.js";

const router = express.Router();

// ---- File uploads (kept in memory, never written to disk or MongoDB) ----
const ALLOWED = ["application/pdf", "text/plain", "text/markdown"];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 }, // 10 MB each, max 5
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype.startsWith("image/") ||
      ALLOWED.includes(file.mimetype) ||
      file.originalname.toLowerCase().endsWith(".md");
    cb(ok ? null : new Error(`Unsupported file type: ${file.originalname}`), ok);
  },
});

const uploadFiles = (req, res, next) =>
  upload.array("files", 5)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });

const normalizeMime = (f) =>
  f.mimetype === "text/markdown" || f.originalname.toLowerCase().endsWith(".md")
    ? "text/plain"
    : f.mimetype;

// ---- Thread routes (all scoped to the logged-in user) ----

router.get("/thread", async (req, res) => {
  try {
    const threads = await Thread.find(
      { userId: req.userId, archived: { $ne: true } },
      "threadId title updatedAt pinned projectId mode"
    ).sort({ pinned: -1, updatedAt: -1 });
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch threads" });
  }
});

// Must stay above /thread/:threadId routes
router.get("/archived", async (req, res) => {
  try {
    const threads = await Thread.find(
      { userId: req.userId, archived: true },
      "threadId title updatedAt"
    ).sort({ updatedAt: -1 });
    res.json(threads);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch archived chats" });
  }
});

router.get("/thread/:threadId", async (req, res) => {
  try {
    const thread = await Thread.findOne({
      threadId: req.params.threadId,
      userId: req.userId,
    });
    if (!thread) return res.status(404).json({ error: "Thread not found" });
    res.json(thread.messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch thread" });
  }
});

router.delete("/thread/:threadId", async (req, res) => {
  try {
    const deleted = await Thread.findOneAndDelete({
      threadId: req.params.threadId,
      userId: req.userId,
    });
    if (!deleted) return res.status(404).json({ error: "Thread not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete thread" });
  }
});

// Rename / pin / archive
router.patch("/thread/:threadId", async (req, res) => {
  const { title, pinned, archived } = req.body;
  const update = {};
  if (typeof title === "string" && title.trim())
    update.title = title.trim().slice(0, 100);
  if (typeof pinned === "boolean") update.pinned = pinned;
  if (typeof archived === "boolean") update.archived = archived;
  if (!Object.keys(update).length)
    return res.status(400).json({ error: "Nothing to update" });

  try {
    const t = await Thread.findOneAndUpdate(
      { threadId: req.params.threadId, userId: req.userId },
      update,
      { new: true, timestamps: false }
    );
    if (!t) return res.status(404).json({ error: "Thread not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update thread" });
  }
});

// Create (or reuse) a public share link id
router.post("/thread/:threadId/share", async (req, res) => {
  try {
    const t = await Thread.findOne(
      { threadId: req.params.threadId, userId: req.userId },
      "shareId"
    );
    if (!t) return res.status(404).json({ error: "Thread not found" });
    let shareId = t.shareId;
    if (!shareId) {
      shareId = randomUUID();
      await Thread.updateOne(
        { threadId: req.params.threadId, userId: req.userId },
        { shareId },
        { timestamps: false }
      );
    }
    res.json({ shareId });
  } catch (err) {
    res.status(500).json({ error: "Failed to share thread" });
  }
});

// ---- Streaming chat. Accepts multipart/form-data:
// threadId, message, mode ("chat" | "codex"), voice, webSearch, thinking, files[]
router.post("/chat/stream", uploadFiles, async (req, res) => {
  const { threadId, message } = req.body;
  const webSearch = req.body.webSearch === "true";
  const thinking = req.body.thinking === "true";
  const voice = req.body.voice === "true";
  const mode = req.body.mode === "codex" ? "codex" : "chat";

  if (!threadId || !message) {
    return res.status(400).json({ error: "threadId and message are required" });
  }

  const files = (req.files || []).slice(0, 5).map((f) => ({
    name: f.originalname,
    mimeType: normalizeMime(f),
    buffer: f.buffer,
  }));

  let aborted = false;
  res.on("close", () => {
    if (!res.writableEnded) aborted = true; // user pressed Stop or left
  });

  try {
    let thread = await Thread.findOne({ threadId, userId: req.userId });
    const isNew = !thread;
    if (!thread) {
      thread = new Thread({
        userId: req.userId,
        threadId,
        title: message.slice(0, 40),
        mode,
      });
    }
    thread.messages.push({
      role: "user",
      content: message,
      attachments: files.map(({ name, mimeType }) => ({ name, mimeType })),
    });
    await thread.save();

    const settings = await getSettings(req.userId);

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders();

    let full = "";
    try {
      for await (const text of streamReply(thread.messages, {
        files,
        webSearch,
        thinking,
        systemInstruction: buildSystemInstruction(settings, thread.mode, voice),
      })) {
        if (aborted) break;
        full += text;
        res.write(text);
      }
    } finally {
      // Save whatever was generated, even if the user stopped midway
      if (full) {
        thread.messages.push({ role: "model", content: full });
        await thread.save();
      }
    }
    res.end();

    // New chat: give it a proper title in the background
    if (isNew && full) {
      try {
        const title = await generateTitle(message);
        if (title) {
          await Thread.updateOne(
            { threadId, userId: req.userId },
            { title },
            { timestamps: false }
          );
        }
      } catch (e) {
        console.error("TITLE ERROR:", e.message);
      }
    }
  } catch (err) {
    console.error("STREAM ERROR:", err);
    if (!res.headersSent) res.status(500).json({ error: "Something went wrong" });
    else res.end();
  }
});

export default router;