import express from "express";
import Thread from "../models/Thread.js";

const router = express.Router();

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim().slice(0, 100);

  try {
    // Empty query: show the most recent chats
    if (!q) {
      const recent = await Thread.find(
        { userId: req.userId, archived: { $ne: true } },
        "threadId title updatedAt"
      )
        .sort({ updatedAt: -1 })
        .limit(20);
      return res.json(recent.map((t) => ({ ...t.toObject(), snippet: "" })));
    }

    const rx = new RegExp(escapeRegex(q), "i");
    const found = await Thread.find(
      {
        userId: req.userId,
        archived: { $ne: true },
        $or: [{ title: rx }, { "messages.content": rx }],
      },
      "threadId title updatedAt messages.content"
    )
      .sort({ updatedAt: -1 })
      .limit(30);

    const results = found.map((t) => {
      const hit = t.messages.find((m) => rx.test(m.content));
      let snippet = "";
      if (hit) {
        const i = hit.content.search(rx);
        const start = Math.max(0, i - 30);
        snippet =
          (start > 0 ? "…" : "") +
          hit.content.slice(start, i + q.length + 60).replace(/\s+/g, " ");
      }
      return {
        threadId: t.threadId,
        title: t.title,
        updatedAt: t.updatedAt,
        snippet,
      };
    });

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;