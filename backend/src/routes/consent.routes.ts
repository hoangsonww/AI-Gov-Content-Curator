import express from "express";
import ConsentLog from "../models/consentLog";

const router = express.Router();


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


router.get("/", async (_req, res) => {
  try {
    const logs = await ConsentLog.find().sort({ createdAt: -1 });

    return res.status(200).json({ logs });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch logs" });
  }
});

export default router;