// Mock mongoose connection to prevent automatic connection
jest.mock("mongoose", () => {
  const actualMongoose = jest.requireActual("mongoose");
  return {
    ...actualMongoose,
    connect: jest.fn().mockResolvedValue({}),
    disconnect: jest.fn().mockResolvedValue({}),
    connection: {
      readyState: 1,
      collections: {},
    },
  };
});

// Mock chat controller to avoid API key requirement
jest.mock("../controllers/chat.controller", () => ({
  handleChat: jest.fn((req, res) => res.json({ reply: "mocked response" })),
  getChatSessions: jest.fn((req, res) => res.json({ sessions: [] })),
  deleteChatSession: jest.fn((req, res) => res.json({ success: true })),
}));

const { MongoMemoryServer } = require("mongodb-memory-server");
const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../app").default;

describe("Cluster Controller", () => {
  let mongoServer;

  beforeAll(async () => {
    // Close any existing connections
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    // Start in-memory MongoDB instance
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    
    // Connect to the in-memory database
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    if (mongoServer) {
      await mongoose.disconnect();
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  describe("GET /api/clusters", () => {
    test("should return empty clusters list initially", async () => {
      const response = await request(app)
        .get("/api/clusters")
        .expect(200);

      expect(response.body).toMatchObject({
        data: [],
        total: 0,
        page: 1,
        limit: 10,
      });
    });

    test("should handle pagination parameters", async () => {
      const response = await request(app)
        .get("/api/clusters?page=2&limit=5")
        .expect(200);

      expect(response.body).toMatchObject({
        data: [],
        total: 0,
        page: 2,
        limit: 5,
      });
    });

    test("should handle since parameter", async () => {
      const sinceDate = new Date().toISOString();
      const response = await request(app)
        .get(`/api/clusters?since=${sinceDate}`)
        .expect(200);

      expect(response.body).toMatchObject({
        data: [],
        total: 0,
      });
    });
  });

  describe("GET /api/clusters/:id", () => {
    test("should return 404 for non-existent cluster", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/clusters/${fakeId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Cluster not found",
      });
    });
  });

  describe("GET /api/articles/:id/cluster", () => {
    test("should return 404 for non-existent article", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .get(`/api/articles/${fakeId}/cluster`)
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Article not found",
      });
    });
  });

  describe("POST /api/internal/cluster/ingest", () => {
    test("should return 400 when articleId is missing", async () => {
      const response = await request(app)
        .post("/api/internal/cluster/ingest")
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Article ID is required",
      });
    });

    test("should handle non-existent article gracefully", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const response = await request(app)
        .post("/api/internal/cluster/ingest")
        .send({ articleId: fakeId.toString() })
        .expect(500);

      expect(response.body).toMatchObject({
        error: "Failed to assign article to cluster",
      });
    });
  });

  describe("POST /api/admin/clusters/rebuild", () => {
    test("should accept rebuild request", async () => {
      const response = await request(app)
        .post("/api/admin/clusters/rebuild")
        .send({ windowDays: 7 })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Clusters rebuilt for last 7 days",
      });
    });

    test("should use default window days", async () => {
      const response = await request(app)
        .post("/api/admin/clusters/rebuild")
        .send({})
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: "Clusters rebuilt for last 14 days",
      });
    });
  });

  describe("POST /api/admin/clusters/merge", () => {
    test("should return 400 when required parameters are missing", async () => {
      const response = await request(app)
        .post("/api/admin/clusters/merge")
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Source and target cluster IDs are required",
      });
    });

    test("should return 404 when clusters don't exist", async () => {
      const fakeId1 = new mongoose.Types.ObjectId();
      const fakeId2 = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .post("/api/admin/clusters/merge")
        .send({
          sourceId: fakeId1.toString(),
          targetId: fakeId2.toString(),
        })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "One or both clusters not found",
      });
    });
  });

  describe("POST /api/admin/clusters/split", () => {
    test("should return 400 when required parameters are missing", async () => {
      const response = await request(app)
        .post("/api/admin/clusters/split")
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Cluster ID and article IDs array are required",
      });
    });

    test("should return 400 when articleIds is not an array", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .post("/api/admin/clusters/split")
        .send({
          clusterId: fakeId.toString(),
          articleIds: "not-an-array",
        })
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Cluster ID and article IDs array are required",
      });
    });

    test("should return 404 when cluster doesn't exist", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      
      const response = await request(app)
        .post("/api/admin/clusters/split")
        .send({
          clusterId: fakeId.toString(),
          articleIds: [new mongoose.Types.ObjectId().toString()],
        })
        .expect(404);

      expect(response.body).toMatchObject({
        error: "Cluster not found",
      });
    });
  });
});