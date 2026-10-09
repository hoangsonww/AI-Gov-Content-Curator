import { Request, Response, NextFunction } from "express";
import { isEnabled, EvalContext } from "../services/featureFlag.service";

function contextFromRequest(req: Request): EvalContext {
  const user = (req as any).user;
  const anonymousId =
    (req.headers["x-anonymous-id"] as string | undefined) ??
    (req.query.anonId as string | undefined);
  return {
    userId: user?.id,
    email: user?.email,
    anonymousId,
  };
}

/**
 * The actual server-side kill switch. Place `optionalAuthenticate` before
 * this on any route that should also recognize logged-in identity, then
 * `requireFeatureFlag(key)` to gate the route itself — not just whatever UI
 * happens to call it. isEnabled() reads Mongo (through a short-TTL cache),
 * so a DB error must not be allowed to hang the request: it's caught here
 * and turned into a clean 503.
 */
export const requireFeatureFlag = (key: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = contextFromRequest(req);
      const enabled = await isEnabled(key, ctx);
      if (!enabled) {
        return res.status(403).json({ error: "Feature disabled", feature: key });
      }
      next();
    } catch (err) {
      console.error(`Feature flag check failed for "${key}":`, err);
      return res.status(503).json({ error: "Feature flag check failed" });
    }
  };
};
