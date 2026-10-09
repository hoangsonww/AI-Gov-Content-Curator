/**
 * Integration test: proves the feature-flag kill switch stops the actual
 * bias-analysis AI call server-side, not just the frontend UI.
 */
jest.mock("../services/biasAnalysis.service", () => ({
  analyzeArticleBias: jest.fn().mockResolvedValue({
    politicalLeaning: { position: "center", score: 0, explanation: "n/a" },
    confidence: 50,
    isBiased: false,
    biasIndicators: [],
    neutralityScore: 100,
    recommendation: "n/a",
  }),
}));

const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { analyzeArticleBias } = require("../services/biasAnalysis.service");

let mongoServer;
let app;
let FeatureFlag;
let service;

const VALID_BODY = {
  title: "Test article",
  content: "x".repeat(150),
};

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  await mongoose.connect(mongoServer.getUri());

  FeatureFlag = require("../models/featureFlag.model").default;
  service = require("../services/featureFlag.service");
  const biasRoutes = require("../routes/bias.routes").default;

  app = express();
  app.use(express.json());
  app.use("/api/bias", biasRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  jest.clearAllMocks();
  await FeatureFlag.deleteMany({});
  service.invalidateCache();
});

it("403s and never calls analyzeArticleBias when the flag is disabled", async () => {
  await FeatureFlag.create({ key: "ai-bias-analysis", enabled: false });

  const res = await request(app).post("/api/bias/analyze").send(VALID_BODY);

  expect(res.status).toBe(403);
  expect(analyzeArticleBias).not.toHaveBeenCalled();
});

it("403s when no flag document exists at all (fail-closed default)", async () => {
  // No ensureBaselineFlags() call in this test harness — simulates a
  // pre-startup/un-seeded state.
  const res = await request(app).post("/api/bias/analyze").send(VALID_BODY);

  expect(res.status).toBe(403);
  expect(analyzeArticleBias).not.toHaveBeenCalled();
});

it("works normally once ensureBaselineFlags() has run", async () => {
  await service.ensureBaselineFlags();

  const res = await request(app).post("/api/bias/analyze").send(VALID_BODY);

  expect(res.status).toBe(200);
  expect(analyzeArticleBias).toHaveBeenCalledTimes(1);
});

it("also gates /analyze-batch", async () => {
  await FeatureFlag.create({ key: "ai-bias-analysis", enabled: false });

  const res = await request(app)
    .post("/api/bias/analyze-batch")
    .send({ articles: [VALID_BODY] });

  expect(res.status).toBe(403);
  expect(analyzeArticleBias).not.toHaveBeenCalled();
});
