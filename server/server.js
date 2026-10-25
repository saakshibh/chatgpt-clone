import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { requireAuth } from "./middleware/auth.js";
import authRoutes from "./routes/auth.js";
import shareRoutes from "./routes/share.js";
import chatRoutes from "./routes/chat.js";
import projectRoutes from "./routes/projects.js";
import searchRoutes from "./routes/search.js";
import settingsRoutes from "./routes/settings.js";
import scheduleRoutes from "./routes/schedules.js";
import { startScheduler } from "./utils/scheduler.js";

if (!process.env.JWT_SECRET) {
  console.error("Missing JWT_SECRET in server/.env");
  process.exit(1);
}

const app = express();
app.set("trust proxy", 1); // needed behind Render's proxy for rate limiting

// CLIENT_URL can hold several origins separated by commas
const allowed = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

// Used by the uptime pinger
app.get("/health", (req, res) => res.json({ ok: true }));

// Public routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many attempts. Try again in a few minutes." },
});
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", shareRoutes);

// Everything below needs a valid login token
app.use("/api", requireAuth);
app.use("/api", chatRoutes);
app.use("/api", projectRoutes);
app.use("/api", searchRoutes);
app.use("/api", settingsRoutes);
app.use("/api", scheduleRoutes);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected");
    startScheduler();
  })
  .catch((e) => console.error(e));

app.listen(process.env.PORT, () =>
  console.log(`Server running on ${process.env.PORT}`)
);