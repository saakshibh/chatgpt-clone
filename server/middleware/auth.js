import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not logged in" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = String(payload.sub);
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Please log in again." });
  }
}