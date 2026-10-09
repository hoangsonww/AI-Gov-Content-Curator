#!/usr/bin/env ts-node
/* eslint-disable no-console */

import * as dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import FeatureFlag from "../models/featureFlag.model";

const { MONGODB_URI = "" } = process.env;
if (!MONGODB_URI) throw new Error("MONGODB_URI missing");

/**
 * Illustrative example flags for documentation/demo purposes. This script
 * is NOT what makes `ai-bias-analysis` work — that flag is self-seeded by
 * `ensureBaselineFlags()` at app startup (see src/app.ts and
 * src/services/featureFlag.service.ts) specifically so no environment can
 * end up with already-shipped functionality silently disabled just because
 * this script wasn't run.
 *
 * Only mutable fields are protected with $setOnInsert — re-running this
 * script never overwrites an admin's live enabled/rolloutPercentage value
 * on a flag that already exists.
 */
const EXAMPLE_FLAGS = [
  {
    key: "example-percentage-rollout-demo",
    description:
      "Illustrative example of a progressive percentage rollout — not wired to any real feature.",
    enabled: true,
    rolloutPercentage: 10,
    audience: { internalUsers: false, premiumOnly: false },
    overrides: { allow: [], deny: [] },
  },
  {
    key: "example-internal-audience-demo",
    description:
      "Illustrative example of an internal-only dogfood flag — not wired to any real feature.",
    enabled: true,
    rolloutPercentage: 0,
    audience: { internalUsers: true, premiumOnly: false },
    overrides: { allow: [], deny: [] },
  },
];

async function seedFeatureFlags(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  let created = 0;
  let alreadyExisted = 0;

  for (const def of EXAMPLE_FLAGS) {
    const existing = await FeatureFlag.findOne({ key: def.key });
    if (existing) {
      alreadyExisted++;
      continue;
    }
    await FeatureFlag.findOneAndUpdate(
      { key: def.key },
      { $setOnInsert: def },
      { upsert: true },
    );
    created++;
  }

  console.log(
    `Feature flag seeding complete. Created: ${created}, already existed: ${alreadyExisted}.`,
  );

  await mongoose.disconnect();
}

seedFeatureFlags()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error seeding feature flags:", err);
    process.exit(1);
  });
