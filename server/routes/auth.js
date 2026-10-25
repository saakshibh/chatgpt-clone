import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Thread from "../models/Thread.js";
import Project from "../models/Project.js";
import Schedule from "../models/Schedule.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

// Recovery code like A1B2C-D3E4F-A1B2C-D3E4F (80 bits, only its hash is stored)
const newRecoveryCode = () =>
  crypto.randomBytes(10).toString("hex").toUpperCase().match(/.{5}/g).join("-");
const normalizeCode = (c) => String(c || "").toUpperCase().replace(/[^0-9A-F]/g, "");
const hashCode = (c) => sha256(normalizeCode(c));

const publicUser = (u) => ({ id: String(u._id), name: u.name, email: u.email });
const sign = (u) =>
  jwt.sign({ sub: String(u._id) }, process.env.JWT_SECRET, { expiresIn: "7d" });

const checkPassword = (p) => {
  if (p.length < 8) return "Password must be at least 8 characters";
  if (p.length > 72) return "Password is too long (max 72 characters)";
  return null;
};

router.post("/register", async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 40);
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name) return res.status(400).json({ error: "Name is required" });
  if (!EMAIL_RX.test(email)) return res.status(400).json({ error: "Enter a valid email" });
  const pwErr = checkPassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  try {
    if (await User.findOne({ email }))
      return res.status(409).json({ error: "This email is already registered" });

    const isFirst = (await User.countDocuments()) === 0;
    const recoveryCode = newRecoveryCode();
    const user = await User.create({
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      recoveryHash: hashCode(recoveryCode),
    });

    // The first account takes over chats made before login existed
    if (isFirst) {
      const uid = String(user._id);
      await Promise.all(
        [Thread, Project, Schedule].map((M) =>
          M.updateMany(
            { userId: { $exists: false } },
            { userId: uid },
            { timestamps: false }
          )
        )
      );
    }

    res.json({ token: sign(user), user: publicUser(user), recoveryCode });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ error: "This email is already registered" });
    console.error(err);
    res.status(500).json({ error: "Could not create account" });
  }
});

router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  try {
    const user = await User.findOne({ email });
    const ok = user && (await bcrypt.compare(password, user.passwordHash));
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Forgot password: email + recovery code + new password
router.post("/forgot-reset", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const code = String(req.body.code || "");
  const password = String(req.body.password || "");

  const pwErr = checkPassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  try {
    const user = await User.findOne({ email });
    const ok = user && user.recoveryHash && user.recoveryHash === hashCode(code);
    if (!ok)
      return res.status(400).json({ error: "Email or recovery code is incorrect" });

    // The code is single use, so a new one is issued
    const recoveryCode = newRecoveryCode();
    user.passwordHash = await bcrypt.hash(password, 10);
    user.recoveryHash = hashCode(recoveryCode);
    await user.save();
    res.json({ message: "Password updated.", recoveryCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not reset password" });
  }
});

// Logged in: change password (wrong current password is a 400, not a 401,
// so the app doesn't think the session expired)
router.post("/change-password", requireAuth, async (req, res) => {
  const current = String(req.body.currentPassword || "");
  const next = String(req.body.newPassword || "");
  const pwErr = checkPassword(next);
  if (pwErr) return res.status(400).json({ error: pwErr });

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Account not found" });
    if (!(await bcrypt.compare(current, user.passwordHash)))
      return res.status(400).json({ error: "Current password is incorrect" });
    user.passwordHash = await bcrypt.hash(next, 10);
    await user.save();
    res.json({ message: "Password changed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not change password" });
  }
});

// Logged in: make a new recovery code (the old one stops working)
router.post("/recovery-code", requireAuth, async (req, res) => {
  const password = String(req.body.password || "");
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Account not found" });
    if (!(await bcrypt.compare(password, user.passwordHash)))
      return res.status(400).json({ error: "Password is incorrect" });
    const recoveryCode = newRecoveryCode();
    user.recoveryHash = hashCode(recoveryCode);
    await user.save();
    res.json({ recoveryCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not create recovery code" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(401).json({ error: "Account not found" });
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: "Failed to load account" });
  }
});

export default router;