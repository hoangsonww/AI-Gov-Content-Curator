import express from "express";
import jwt from "jsonwebtoken";
import ConsentLog from "../models/consentLog";

const router = express.Router();

/* ---------------- AUTH ---------------- */

const requireAuth = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

/* ---------------- ROUTES ---------------- */

router.post("/", async (req, res) => {
  try {
    const { consent, timestamp } = req.body;

    if (!consent) {
      return res.status(400).json({ error: "Consent value required" });
    }

    const log = await ConsentLog.create({
      consent,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });

    return res.status(200).json({
      success: true,
      log,
    });
  } catch (err) {
    console.error("Consent logging failed:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/", requireAuth, requireAdmin, async (_req, res) => {
  try {
    const logs = await ConsentLog.find().sort({ createdAt: -1 }).limit(100);

    return res.status(200).json({ logs });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch logs" });
  }
});

export default router;