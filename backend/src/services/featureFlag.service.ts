import crypto from "crypto";
import FeatureFlag, { IFeatureFlag } from "../models/featureFlag.model";

/**
 * Flags that are self-seeded at app startup (see ensureBaselineFlags) and
 * cannot be deleted via the admin API — only disabled via enabled:false.
 * Single source of truth: imported by both ensureBaselineFlags() and the
 * controller's delete guard so the two can never drift apart.
 */
export const BASELINE_FLAG_KEYS: string[] = ["ai-bias-analysis"];

const CACHE_TTL_MS = 10_000;

let cache: { flags: Map<string, IFeatureFlag>; expiresAt: number } | null =
  null;

async function loadFlags(): Promise<Map<string, IFeatureFlag>> {
  if (cache && cache.expiresAt > Date.now()) return cache.flags;

  const docs = await FeatureFlag.find().lean();
  const flags = new Map<string, IFeatureFlag>();
  for (const doc of docs) {
    flags.set(doc.key, doc as unknown as IFeatureFlag);
  }
  cache = { flags, expiresAt: Date.now() + CACHE_TTL_MS };
  return flags;
}

export function invalidateCache(): void {
  cache = null;
}

export interface EvalContext {
  userId?: string;
  email?: string;
  anonymousId?: string;
}

/**
 * Returns a stable identity string for bucketing, or undefined when the
 * caller has no user id and no anonymous id (e.g. an unauthenticated
 * server-to-server/ingestion call with no x-anonymous-id header).
 */
export function resolveIdentity(ctx: EvalContext): string | undefined {
  return ctx.userId ?? ctx.anonymousId ?? undefined;
}

export function isInternalUser(email?: string): boolean {
  if (!email) return false;
  const domains = (process.env.FEATURE_FLAG_INTERNAL_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (!domains.length) return false;
  const emailDomain = email.toLowerCase().split("@")[1] ?? "";
  return domains.includes(emailDomain);
}

/**
 * No premium/subscription concept exists anywhere in this codebase today
 * (checked user.model.ts, rating.model.ts, comment.model.ts). This is an
 * explicit, forward-looking stub — premiumOnly flags are unreachable until
 * a real premium concept is introduced.
 */
export function isPremiumUser(_ctx: EvalContext): boolean {
  return false;
}

export function bucketOf(flagKey: string, identity: string): number {
  const hash = crypto
    .createHash("sha256")
    .update(`${flagKey}:${identity}`)
    .digest("hex");
  return parseInt(hash.slice(0, 8), 16) % 100;
}

function matches(list: string[] | undefined, ctx: EvalContext): boolean {
  if (!list || !list.length) return false;
  const candidates = [ctx.userId, ctx.email].filter(Boolean) as string[];
  if (!candidates.length) return false;
  return list.some((entry) => candidates.includes(entry));
}

export async function isEnabled(
  key: string,
  ctx: EvalContext,
): Promise<boolean> {
  const flags = await loadFlags();
  const flag = flags.get(key);

  // New code, spelled out explicitly: a flag that doesn't exist yet is OFF.
  if (!flag) return false;

  if (!flag.enabled) return false;

  if (matches(flag.overrides?.deny, ctx)) return false;
  if (matches(flag.overrides?.allow, ctx)) return true;

  const identity = resolveIdentity(ctx);
  const premiumOnly = flag.audience?.premiumOnly ?? false;
  const internalUsers = flag.audience?.internalUsers ?? false;
  const rolloutPercentage = flag.rolloutPercentage ?? 100;

  if (identity === undefined) {
    // No identity (e.g. an unauthenticated server-to-server/ingestion call):
    // restrictions still restrict, bypasses don't bypass, and percentage
    // rollout only ever passes once the flag is fully launched.
    if (premiumOnly) return false;
    return rolloutPercentage === 100;
  }

  if (premiumOnly && !isPremiumUser(ctx)) return false;
  if (internalUsers && isInternalUser(ctx.email)) return true;

  return bucketOf(key, identity) < rolloutPercentage;
}

export async function evaluateAll(
  ctx: EvalContext,
  keys?: string[],
): Promise<Record<string, boolean>> {
  const flags = await loadFlags();
  const targetKeys = keys && keys.length ? keys : Array.from(flags.keys());
  const result: Record<string, boolean> = {};
  for (const key of targetKeys) {
    result[key] = await isEnabled(key, ctx);
  }
  return result;
}

export async function listFlags(): Promise<IFeatureFlag[]> {
  return FeatureFlag.find().sort({ key: 1 }).lean();
}

export async function getFlagByKey(
  key: string,
): Promise<IFeatureFlag | null> {
  return FeatureFlag.findOne({ key }).lean();
}

export async function createFlag(
  data: Partial<IFeatureFlag>,
): Promise<IFeatureFlag> {
  const doc = await FeatureFlag.create(data);
  invalidateCache();
  return doc;
}

export async function updateFlag(
  key: string,
  data: Partial<IFeatureFlag>,
): Promise<IFeatureFlag | null> {
  const doc = await FeatureFlag.findOneAndUpdate(
    { key },
    { $set: data },
    { new: true },
  );
  invalidateCache();
  return doc;
}

export async function deleteFlag(key: string): Promise<boolean> {
  const result = await FeatureFlag.deleteOne({ key });
  invalidateCache();
  return result.deletedCount === 1;
}

/**
 * Idempotent startup bootstrap. Guarantees every key in BASELINE_FLAG_KEYS
 * exists (enabled by default) in any environment — local dev, staging,
 * production — without depending on anyone remembering to run a seed
 * script. Never touches a flag that already exists, so an admin's live
 * enabled/rolloutPercentage value is never clobbered.
 */
export async function ensureBaselineFlags(): Promise<void> {
  for (const key of BASELINE_FLAG_KEYS) {
    await FeatureFlag.findOneAndUpdate(
      { key },
      {
        $setOnInsert: {
          key,
          description: `Baseline flag for ${key}`,
          enabled: true,
          rolloutPercentage: 100,
          audience: { internalUsers: false, premiumOnly: false },
          overrides: { allow: [], deny: [] },
        },
      },
      { upsert: true },
    );
  }
  invalidateCache();
}
