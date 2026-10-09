/**
 * Unit test for the feature flag evaluation service: no Express/supertest
 * needed, just Mongoose against mongodb-memory-server.
 */
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;
let FeatureFlag;
let service;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  await mongoose.connect(mongoServer.getUri());

  FeatureFlag = require("../models/featureFlag.model").default;
  service = require("../services/featureFlag.service");
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await FeatureFlag.deleteMany({});
  service.invalidateCache();
});

describe("isEnabled", () => {
  it("returns false for a key with no DB document", async () => {
    const result = await service.isEnabled("does-not-exist", {
      userId: "u1",
    });
    expect(result).toBe(false);
  });

  it("acts as a kill switch when enabled is false", async () => {
    await FeatureFlag.create({
      key: "kill-switch-demo",
      enabled: false,
      rolloutPercentage: 100,
    });
    const result = await service.isEnabled("kill-switch-demo", {
      userId: "u1",
    });
    expect(result).toBe(false);
  });

  it("is false for everyone at rolloutPercentage 0", async () => {
    await FeatureFlag.create({
      key: "rollout-0",
      enabled: true,
      rolloutPercentage: 0,
    });
    const result = await service.isEnabled("rollout-0", { userId: "u1" });
    expect(result).toBe(false);
  });

  it("is true for everyone at rolloutPercentage 100", async () => {
    await FeatureFlag.create({
      key: "rollout-100",
      enabled: true,
      rolloutPercentage: 100,
    });
    const result = await service.isEnabled("rollout-100", { userId: "u1" });
    expect(result).toBe(true);
  });

  it("is deterministic for a fixed identity across repeated calls", async () => {
    await FeatureFlag.create({
      key: "rollout-50",
      enabled: true,
      rolloutPercentage: 50,
    });
    const first = await service.isEnabled("rollout-50", { userId: "stable-user" });
    const second = await service.isEnabled("rollout-50", { userId: "stable-user" });
    expect(second).toBe(first);
  });

  it("lets internal users bypass the percentage rollout", async () => {
    process.env.FEATURE_FLAG_INTERNAL_EMAIL_DOMAINS = "internal.test.com";
    await FeatureFlag.create({
      key: "internal-bypass",
      enabled: true,
      rolloutPercentage: 0,
      audience: { internalUsers: true, premiumOnly: false },
    });
    const result = await service.isEnabled("internal-bypass", {
      userId: "u1",
      email: "person@internal.test.com",
    });
    expect(result).toBe(true);
    delete process.env.FEATURE_FLAG_INTERNAL_EMAIL_DOMAINS;
  });

  it("restricts premiumOnly flags to premium users (currently always false — no premium concept exists)", async () => {
    await FeatureFlag.create({
      key: "premium-only",
      enabled: true,
      rolloutPercentage: 100,
      audience: { internalUsers: false, premiumOnly: true },
    });
    const result = await service.isEnabled("premium-only", { userId: "u1" });
    expect(result).toBe(false);
  });

  it("deny list overrides everything, including a 100% rollout", async () => {
    await FeatureFlag.create({
      key: "deny-test",
      enabled: true,
      rolloutPercentage: 100,
      overrides: { allow: [], deny: ["blocked-user"] },
    });
    const result = await service.isEnabled("deny-test", {
      userId: "blocked-user",
    });
    expect(result).toBe(false);
  });

  it("allow list forces a flag on even at 0% rollout", async () => {
    await FeatureFlag.create({
      key: "allow-test",
      enabled: true,
      rolloutPercentage: 0,
      overrides: { allow: ["vip-user"], deny: [] },
    });
    const result = await service.isEnabled("allow-test", {
      userId: "vip-user",
    });
    expect(result).toBe(true);
  });

  describe("no identity (server-to-server/batch callers)", () => {
    it("fails closed for premiumOnly even though a restriction can't be verified", async () => {
      await FeatureFlag.create({
        key: "no-identity-premium",
        enabled: true,
        rolloutPercentage: 100,
        audience: { internalUsers: false, premiumOnly: true },
      });
      const result = await service.isEnabled("no-identity-premium", {});
      expect(result).toBe(false);
    });

    it("does not grant the internalUsers bypass without identity", async () => {
      await FeatureFlag.create({
        key: "no-identity-internal",
        enabled: true,
        rolloutPercentage: 0,
        audience: { internalUsers: true, premiumOnly: false },
      });
      const result = await service.isEnabled("no-identity-internal", {});
      expect(result).toBe(false);
    });

    it("passes at rolloutPercentage 100", async () => {
      await FeatureFlag.create({
        key: "no-identity-100",
        enabled: true,
        rolloutPercentage: 100,
      });
      const result = await service.isEnabled("no-identity-100", {});
      expect(result).toBe(true);
    });

    it("fails at rolloutPercentage 99 (not fractionally bucketable without identity)", async () => {
      await FeatureFlag.create({
        key: "no-identity-99",
        enabled: true,
        rolloutPercentage: 99,
      });
      const result = await service.isEnabled("no-identity-99", {});
      expect(result).toBe(false);
    });

    it("still respects the master kill switch", async () => {
      await FeatureFlag.create({
        key: "no-identity-killed",
        enabled: false,
        rolloutPercentage: 100,
      });
      const result = await service.isEnabled("no-identity-killed", {});
      expect(result).toBe(false);
    });
  });
});
