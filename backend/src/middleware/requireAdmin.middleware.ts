import { Request, Response, NextFunction } from "express";

/**
 * Must run after `authenticate`. Restricts a route to the comma-separated
 * allowlist of emails in FEATURE_FLAG_ADMIN_EMAILS — mirrors the
 * comma-separated RP_ORIGIN parsing pattern already used elsewhere in this
 * service. There is no role/isAdmin concept anywhere else in the codebase;
 * this env-based allowlist is intentionally the simplest thing that works.
 */
export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const email = (req as any).user?.email?.toLowerCase();
  const admins = (process.env.FEATURE_FLAG_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!email || !admins.includes(email)) {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
};
