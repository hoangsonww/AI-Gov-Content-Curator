/**
 * Integration test: real Express + real Mongoose, following the
 * passkey.routes.spec.js convention.
 */
const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;
let app;
let FeatureFlag;
let service;

const ADMIN_EMAIL = "admin@test.com";

beforeAll(async () => {
  process.env.FEATURE_FLAG_ADMIN_EMAILS = ADMIN_EMAIL;

  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  await mongoose.connect(mongoServer.getUri());

  FeatureFlag = require("../models/featureFlag.model").default;
  service = require("../services/featureFlag.service");
  const featureFlagRoutes = require("../routes/featureFlag.routes").default;

  app = express();
  app.use(express.json());
  app.use("/api/flags", featureFlagRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  delete process.env.FEATURE_FLAG_ADMIN_EMAILS;
});

afterEach(async () => {
  await FeatureFlag.deleteMany({});
  service.invalidateCache();
});

const tokenFor = (email) =>
  jwt.sign({ id: email, email }, "your_jwt_secret", { expiresIn: "1h" });

describe("admin CRUD", () => {
  it("rejects a non-admin with 403 on every admin route", async () => {
    const token = tokenFor("not-admin@test.com");
    const list = await request(app)
      .get("/api/flags")
      .set("Authorization", token);
    expect(list.status).toBe(403);

    const create = await request(app)
      .post("/api/flags")
      .set("Authorization", token)
      .send({ key: "nope" });
    expect(create.status).toBe(403);
  });

  it("allows an admin to create, list, get, update, and delete a flag", async () => {
    const token = tokenFor(ADMIN_EMAIL);

    const create = await request(app)
      .post("/api/flags")
      .set("Authorization", token)
      .send({ key: "demo-flag", enabled: true, rolloutPercentage: 50 });
    expect(create.status).toBe(201);

    const list = await request(app)
      .get("/api/flags")
      .set("Authorization", token);
    expect(list.status).toBe(200);
    expect(list.body.some((f) => f.key === "demo-flag")).toBe(true);

    const get = await request(app)
      .get("/api/flags/demo-flag")
      .set("Authorization", token);
    expect(get.status).toBe(200);
    expect(get.body.rolloutPercentage).toBe(50);

    const update = await request(app)
      .put("/api/flags/demo-flag")
      .set("Authorization", token)
      .send({ enabled: false });
    expect(update.status).toBe(200);
    expect(update.body.enabled).toBe(false);

    const del = await request(app)
      .delete("/api/flags/demo-flag")
      .set("Authorization", token);
    expect(del.status).toBe(200);
  });

  it("refuses to delete a baseline flag", async () => {
    const token = tokenFor(ADMIN_EMAIL);
    await FeatureFlag.create({ key: "ai-bias-analysis", enabled: true });

    const del = await request(app)
      .delete("/api/flags/ai-bias-analysis")
      .set("Authorization", token);
    expect(del.status).toBe(400);

    const stillThere = await FeatureFlag.findOne({ key: "ai-bias-analysis" });
    expect(stillThere).not.toBeNull();
  });
});

describe("GET /api/flags/evaluate", () => {
  it("works for an anonymous caller with only x-anonymous-id, not 401", async () => {
    await FeatureFlag.create({
      key: "anon-flag",
      enabled: true,
      rolloutPercentage: 100,
    });

    const res = await request(app)
      .get("/api/flags/evaluate")
      .set("x-anonymous-id", "anon-123");
    expect(res.status).toBe(200);
    expect(res.body.flags["anon-flag"]).toBe(true);
  });

  it("returns a clean 503, not a hang, when the DB read fails", async () => {
    const spy = jest
      .spyOn(FeatureFlag, "find")
      .mockImplementation(() => ({
        lean: () => Promise.reject(new Error("simulated DB failure")),
      }));

    const res = await request(app).get("/api/flags/evaluate");
    expect(res.status).toBe(503);

    spy.mockRestore();
  });
});
