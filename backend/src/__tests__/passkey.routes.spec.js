/**
 * Integration test: real Express + real Mongoose + mocked WebAuthn library.
 * Exercises the full /api/auth/passkey/* route stack to catch wiring bugs
 * the unit tests can't see.
 */
jest.mock("../services/webauthn.service", () => ({
  RP_ID: "localhost",
  RP_NAME: "Test",
  RP_ORIGINS: ["http://localhost:3000"],
  CHALLENGE_TTL_MS: 5 * 60 * 1000,
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

const express = require("express");
const mongoose = require("mongoose");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");

const webauthn = require("../services/webauthn.service");

let mongoServer;
let app;
let User, Passkey;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  User = require("../models/user.model").default;
  Passkey = require("../models/passkey.model").default;
  const passkeyRoutes = require("../routes/passkey.routes").default;

  app = express();
  app.use(express.json());
  app.use("/api/auth/passkey", passkeyRoutes);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  jest.clearAllMocks();
  await User.deleteMany({});
  await Passkey.deleteMany({});
  const Challenge = require("../models/webauthn-challenge.model").default;
  await Challenge.deleteMany({});
});

const authTokenFor = (userId, email) =>
  jwt.sign({ id: userId, email }, "your_jwt_secret", { expiresIn: "1h" });

const buildClientDataJSON = (challenge) =>
  Buffer.from(JSON.stringify({ challenge }), "utf8").toString("base64url");

describe("POST /api/auth/passkey/authenticate/begin", () => {
  it("returns options without auth", async () => {
    webauthn.generateAuthenticationOptions.mockResolvedValue({
      challenge: "ch-auth",
      rpId: "localhost",
      allowCredentials: [],
    });

    const res = await request(app)
      .post("/api/auth/passkey/authenticate/begin")
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.challenge).toBe("ch-auth");

    const Challenge = require("../models/webauthn-challenge.model").default;
    const stored = await Challenge.findOne({ challenge: "ch-auth" });
    expect(stored).toBeDefined();
    expect(stored.type).toBe("authentication");
  });
});

describe("POST /api/auth/passkey/register/begin", () => {
  it("401 without auth header", async () => {
    const res = await request(app)
      .post("/api/auth/passkey/register/begin")
      .send({});
    expect(res.status).toBe(401);
  });

  it("returns options for an authenticated user", async () => {
    const user = await User.create({
      email: "a@b.com",
      password: "hashed",
      favorites: [],
    });
    webauthn.generateRegistrationOptions.mockResolvedValue({
      challenge: "ch-reg",
    });
    const token = authTokenFor(String(user._id), user.email);

    const res = await request(app)
      .post("/api/auth/passkey/register/begin")
      .set("Authorization", token)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.challenge).toBe("ch-reg");
  });
});

describe("Passkey CRUD", () => {
  it("lists, renames, and deletes the caller's passkeys", async () => {
    const user = await User.create({
      email: "a@b.com",
      password: "hashed",
      hasPasskeys: true,
      favorites: [],
    });
    const pk = await Passkey.create({
      userId: user._id,
      credentialId: "cred-1",
      publicKey: Buffer.from([1, 2, 3]),
      counter: 0,
      nickname: "Old name",
    });
    const token = authTokenFor(String(user._id), user.email);

    const list = await request(app)
      .get("/api/auth/passkey")
      .set("Authorization", token);
    expect(list.status).toBe(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].nickname).toBe("Old name");

    const rename = await request(app)
      .patch(`/api/auth/passkey/${pk._id}`)
      .set("Authorization", token)
      .send({ nickname: "New name" });
    expect(rename.status).toBe(200);
    expect(rename.body.nickname).toBe("New name");

    const del = await request(app)
      .delete(`/api/auth/passkey/${pk._id}`)
      .set("Authorization", token);
    // Last passkey on a passworded account is allowed to be deleted.
    expect(del.status).toBe(200);

    const empty = await request(app)
      .get("/api/auth/passkey")
      .set("Authorization", token);
    expect(empty.body).toHaveLength(0);

    // hasPasskeys flipped back to false
    const refreshed = await User.findById(user._id);
    expect(refreshed.hasPasskeys).toBe(false);
  });

  it("refuses to delete the last passkey when no password is set", async () => {
    const user = await User.create({
      email: "a@b.com",
      hasPasskeys: true,
      favorites: [],
    });
    const pk = await Passkey.create({
      userId: user._id,
      credentialId: "cred-only",
      publicKey: Buffer.from([1, 2, 3]),
      counter: 0,
      nickname: "Only",
    });
    const token = authTokenFor(String(user._id), user.email);

    const res = await request(app)
      .delete(`/api/auth/passkey/${pk._id}`)
      .set("Authorization", token);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/last passkey/i);

    // Passkey is still there.
    const list = await Passkey.find({ userId: user._id });
    expect(list).toHaveLength(1);
  });

  it("a user cannot rename or delete another user's passkey", async () => {
    const a = await User.create({
      email: "a@b.com",
      password: "hashed",
      hasPasskeys: true,
      favorites: [],
    });
    const b = await User.create({
      email: "b@b.com",
      password: "hashed",
      hasPasskeys: true,
      favorites: [],
    });
    const aPk = await Passkey.create({
      userId: a._id,
      credentialId: "cred-a",
      publicKey: Buffer.from([1]),
      counter: 0,
      nickname: "A's",
    });

    const bToken = authTokenFor(String(b._id), b.email);
    const rename = await request(app)
      .patch(`/api/auth/passkey/${aPk._id}`)
      .set("Authorization", bToken)
      .send({ nickname: "Hijack" });
    expect(rename.status).toBe(404);

    const del = await request(app)
      .delete(`/api/auth/passkey/${aPk._id}`)
      .set("Authorization", bToken);
    expect(del.status).toBe(404);
  });
});

describe("Passkey signup flow (no orphan user)", () => {
  it("/signup/begin does NOT create a user — only verify does", async () => {
    webauthn.generateRegistrationOptions.mockResolvedValue({
      challenge: "ch-signup",
    });
    const res = await request(app)
      .post("/api/auth/passkey/signup/begin")
      .send({ email: "new@x.com", name: "New" });
    expect(res.status).toBe(200);

    const u = await User.findOne({ email: "new@x.com" });
    expect(u).toBeNull();

    const Challenge = require("../models/webauthn-challenge.model").default;
    const ch = await Challenge.findOne({ challenge: "ch-signup" });
    expect(ch.email).toBe("new@x.com");
    expect(ch.userId).toBeUndefined();
  });

  it("/signup/begin rejects existing emails", async () => {
    await User.create({
      email: "exists@x.com",
      password: "hashed",
      favorites: [],
    });
    const res = await request(app)
      .post("/api/auth/passkey/signup/begin")
      .send({ email: "exists@x.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it("/signup/verify creates user + passkey atomically and issues JWT", async () => {
    webauthn.generateRegistrationOptions.mockResolvedValue({
      challenge: "ch-flow",
    });
    await request(app)
      .post("/api/auth/passkey/signup/begin")
      .send({ email: "atomic@x.com", name: "Atom" });

    webauthn.verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: {
          id: "cred-atomic",
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 0,
        },
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
      },
    });

    const verify = await request(app)
      .post("/api/auth/passkey/signup/verify")
      .send({
        email: "atomic@x.com",
        name: "Atom",
        nickname: "iPhone",
        response: {
          response: { clientDataJSON: buildClientDataJSON("ch-flow") },
        },
      });
    expect(verify.status).toBe(201);
    expect(verify.body.token).toBeDefined();
    expect(verify.body.user.email).toBe("atomic@x.com");

    const u = await User.findOne({ email: "atomic@x.com" });
    expect(u).toBeDefined();
    expect(u.hasPasskeys).toBe(true);
    expect(u.password).toBeUndefined();

    const pk = await Passkey.findOne({ credentialId: "cred-atomic" });
    expect(pk).toBeDefined();
    expect(pk.nickname).toBe("iPhone");
  });
});
