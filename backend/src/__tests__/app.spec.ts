import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import app from "../app";
import Article from "../models/article.model";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  // clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe("❇️ Root & Docs endpoints", () => {
  it("GET / should redirect (302) to /api-docs", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/api-docs");
  });

  it("GET /api-docs returns HTML", async () => {
    const res = await request(app).get("/api-docs");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/<title>Article Curator API Docs<\/title>/);
  });

  it("GET /swagger.json returns JSON", async () => {
    const res = await request(app).get("/swagger.json");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("openapi");
  });

  it("unknown route returns 404 JSON", async () => {
    const res = await request(app).get("/no-such-route");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Route not found" });
  });
});

describe("🔗 /api/articles CRUD", () => {
  it("GET /api/articles → empty array", async () => {
    const res = await request(app).get("/api/articles");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("can GET an article by ID after inserting via Mongoose", async () => {
    const data = {
      url: "https://example.com/a",
      title: "Test Title",
      content: "Test content",
      summary: "Test summary",
      topics: ["test", "example"],
      source: "unit-test",
      fetchedAt: new Date(),
    };
    const created = await Article.create(data);

    const listRes = await request(app).get("/api/articles");
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0]._id).toBe(created.id);

    const getRes = await request(app).get(`/api/articles/${created.id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.title).toBe(data.title);
    expect(getRes.body.url).toBe(data.url);
  });

  it("GET /api/articles/:id for non-existent ID returns 404", async () => {
    const res = await request(app).get(
      `/api/articles/${new mongoose.Types.ObjectId().toHexString()}`,
    );
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Article not found" });
  });

  it("validation: POST /api/articles with missing fields returns 400", async () => {
    const res = await request(app)
      .post("/api/articles")
      .send({ title: "No URL" });
    expect(res.status).toBe(400);
  });

  it("can CREATE → POST /api/articles", async () => {
    const payload = {
      url: "https://example.com/b",
      title: "Another Title",
      content: "Content here",
      summary: "Sum",
      topics: ["a", "b"],
      source: "unit-test",
    };
    const res = await request(app).post("/api/articles").send(payload);
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("_id");
    expect(res.body.title).toBe(payload.title);

    // cleanup: verify in DB
    const count = await Article.countDocuments({ url: payload.url });
    expect(count).toBe(1);
  });

  it("can UPDATE → PUT /api/articles/:id", async () => {
    const art = await Article.create({
      url: "u",
      title: "T",
      content: "C",
      summary: "S",
      topics: [],
      source: "s",
      fetchedAt: new Date(),
    });
    const res = await request(app)
      .put(`/api/articles/${art.id}`)
      .send({ title: "Updated" });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe("Updated");
  });

  it("can DELETE → DELETE /api/articles/:id", async () => {
    const art = await Article.create({
      url: "u2",
      title: "T2",
      content: "C2",
      summary: "S2",
      topics: [],
      source: "s2",
      fetchedAt: new Date(),
    });
    const res = await request(app).delete(`/api/articles/${art.id}`);
    expect(res.status).toBe(204);
    const exists = await Article.exists({ _id: art.id });
    expect(exists).toBeFalsy();
  });
});
