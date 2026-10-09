import { Request, Response } from "express";
import {
  listFlags as listFlagsService,
  getFlagByKey,
  createFlag as createFlagService,
  updateFlag as updateFlagService,
  deleteFlag as deleteFlagService,
  evaluateAll,
  BASELINE_FLAG_KEYS,
  EvalContext,
} from "../services/featureFlag.service";

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
 * GET /api/flags
 */
export const listFlags = async (_req: Request, res: Response) => {
  try {
    const flags = await listFlagsService();
    return res.json(flags);
  } catch (error) {
    console.error("Error listing feature flags:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * GET /api/flags/:key
 */
export const getFlag = async (req: Request, res: Response) => {
  try {
    const flag = await getFlagByKey(req.params.key);
    if (!flag) return res.status(404).json({ error: "Flag not found" });
    return res.json(flag);
  } catch (error) {
    console.error("Error fetching feature flag:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * POST /api/flags
 */
export const createFlag = async (req: Request, res: Response) => {
  try {
    const { key } = req.body;
    if (!key || typeof key !== "string") {
      return res.status(400).json({ error: "key is required" });
    }

    const existing = await getFlagByKey(key.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ error: "A flag with this key already exists" });
    }

    const flag = await createFlagService({
      ...req.body,
      createdBy: (req as any).user?.email,
    });
    return res.status(201).json(flag);
  } catch (error) {
    console.error("Error creating feature flag:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * PUT /api/flags/:key
 */
export const updateFlag = async (req: Request, res: Response) => {
  try {
    const flag = await updateFlagService(req.params.key, {
      ...req.body,
      updatedBy: (req as any).user?.email,
    });
    if (!flag) return res.status(404).json({ error: "Flag not found" });
    return res.json(flag);
  } catch (error) {
    console.error("Error updating feature flag:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * DELETE /api/flags/:key
 * Baseline flags (self-seeded at startup) must be disabled via
 * enabled:false, never deleted — otherwise ensureBaselineFlags() would
 * silently recreate them as enabled:true on the next restart.
 */
export const deleteFlag = async (req: Request, res: Response) => {
  try {
    const key = req.params.key.toLowerCase().trim();
    if (BASELINE_FLAG_KEYS.includes(key)) {
      return res.status(400).json({
        error: "Baseline flags cannot be deleted; set enabled=false instead.",
      });
    }

    const deleted = await deleteFlagService(key);
    if (!deleted) return res.status(404).json({ error: "Flag not found" });
    return res.json({ message: "Flag deleted" });
  } catch (error) {
    console.error("Error deleting feature flag:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * GET /api/flags/evaluate
 * Works for both authenticated and anonymous callers (mount with
 * optionalAuthenticate). Own try/catch, separate from requireFeatureFlag's,
 * so a DB error here also returns a clean 503 rather than hanging.
 */
export const evaluateFlags = async (req: Request, res: Response) => {
  try {
    const ctx = contextFromRequest(req);
    const keysParam = req.query.keys as string | undefined;
    const keys = keysParam
      ? keysParam.split(",").map((k) => k.trim()).filter(Boolean)
      : undefined;

    const flags = await evaluateAll(ctx, keys);
    return res.json({ flags });
  } catch (error) {
    console.error("Error evaluating feature flags:", error);
    return res.status(503).json({ error: "Feature flag check failed" });
  }
};
