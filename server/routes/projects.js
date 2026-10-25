import express from "express";
import mongoose from "mongoose";
import Project from "../models/Project.js";
import Thread from "../models/Thread.js";

const router = express.Router();
const validId = (id) => mongoose.isValidObjectId(id);

router.get("/projects", async (req, res) => {
  try {
    const projects = await Project.find({ userId: req.userId }, "name").sort({
      createdAt: 1,
    });
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch projects" });
  }
});

router.post("/projects", async (req, res) => {
  const name = (req.body.name || "").trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const p = await Project.create({ userId: req.userId, name });
    res.json({ _id: p._id, name: p.name });
  } catch (err) {
    res.status(500).json({ error: "Failed to create project" });
  }
});

// Move a chat into a project (projectId: null removes it from its project)
router.put("/projects/move", async (req, res) => {
  const { threadId, projectId } = req.body;
  if (!threadId) return res.status(400).json({ error: "threadId is required" });
  try {
    if (projectId) {
      if (!validId(projectId))
        return res.status(404).json({ error: "Project not found" });
      const p = await Project.findOne({ _id: projectId, userId: req.userId });
      if (!p) return res.status(404).json({ error: "Project not found" });
    }
    const t = await Thread.findOneAndUpdate(
      { threadId, userId: req.userId },
      { projectId: projectId || null },
      { timestamps: false }
    );
    if (!t) return res.status(404).json({ error: "Thread not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to move thread" });
  }
});

router.patch("/projects/:id", async (req, res) => {
  const name = (req.body.name || "").trim().slice(0, 60);
  if (!name) return res.status(400).json({ error: "Name is required" });
  if (!validId(req.params.id)) return res.status(404).json({ error: "Project not found" });
  try {
    const p = await Project.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { name }
    );
    if (!p) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to rename project" });
  }
});

// Delete project (its chats go back to Recents, they are not deleted)
router.delete("/projects/:id", async (req, res) => {
  if (!validId(req.params.id)) return res.status(404).json({ error: "Project not found" });
  try {
    const p = await Project.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!p) return res.status(404).json({ error: "Project not found" });
    await Thread.updateMany(
      { userId: req.userId, projectId: req.params.id },
      { projectId: null },
      { timestamps: false }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;