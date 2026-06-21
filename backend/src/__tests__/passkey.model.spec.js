/**
 * Real-Mongo integration test for the User / Passkey / WebAuthnChallenge
 * schemas. Exercises validators, indexes, and TTL configuration with
 * mongodb-memory-server.
 */
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongoServer;
let User, Passkey, Challenge;

beforeAll(async () => {
  // Windows CI runners regularly need >10s (the lib default) to launch mongod;
  // a too-short launchTimeout rejects here and cascades into undefined-model errors.
  mongoServer = await MongoMemoryServer.create({
    instance: { launchTimeout: 60000 },
  });
  await mongoose.connect(mongoServer.getUri());

  // Lazy-load AFTER mongoose connect so models register on the same connection.
  User = require("../models/user.model").default;
  Passkey = require("../models/passkey.model").default;
  Challenge = require("../models/webauthn-challenge.model").default;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.deleteMany({});
  await Passkey.deleteMany({});
  await Challenge.deleteMany({});
});

describe("User model", () => {
  it("requires at least one of password / hasPasskeys", async () => {
    const u = new User({ email: "a@b.com", isVerified: false, favorites: [] });
    await expect(u.save()).rejects.toThrow(/at least one credential/);
  });

  it("accepts a password-only user", async () => {
    const u = new User({
      email: "a@b.com",
      password: "hashed",
      isVerified: false,
      favorites: [],
    });
    await expect(u.save()).resolves.toBeDefined();
  });

  it("accepts a passkey-only user (no password)", async () => {
    const u = new User({
      email: "a@b.com",
      hasPasskeys: true,
      isVerified: false,
      favorites: [],
    });
    const saved = await u.save();
    expect(saved.password).toBeUndefined();
    expect(saved.hasPasskeys).toBe(true);
  });
});

describe("Passkey model", () => {
  let user;
  beforeEach(async () => {
    user = await User.create({
      email: "a@b.com",
      hasPasskeys: true,
      favorites: [],
    });
  });

  it("enforces uniqueness of credentialId", async () => {
    await Passkey.init(); // ensure indexes are built
    await Passkey.create({
      userId: user._id,
      credentialId: "cred-1",
      publicKey: Buffer.from([1, 2, 3]),
      counter: 0,
      nickname: "A",
    });
    await expect(
      Passkey.create({
        userId: user._id,
        credentialId: "cred-1",
        publicKey: Buffer.from([4, 5, 6]),
        counter: 0,
        nickname: "B",
      }),
    ).rejects.toThrow();
  });

  it("supports multiple passkeys per user", async () => {
    await Passkey.create([
      {
        userId: user._id,
        credentialId: "cred-a",
        publicKey: Buffer.from([1]),
        counter: 0,
        nickname: "A",
      },
      {
        userId: user._id,
        credentialId: "cred-b",
        publicKey: Buffer.from([2]),
        counter: 0,
        nickname: "B",
      },
    ]);
    const list = await Passkey.find({ userId: user._id });
    expect(list).toHaveLength(2);
  });

  it("preserves publicKey bytes round-trip", async () => {
    const bytes = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    const created = await Passkey.create({
      userId: user._id,
      credentialId: "cred-bytes",
      publicKey: bytes,
      counter: 5,
      nickname: "Bytes",
    });
    const fetched = await Passkey.findById(created._id);
    expect(Buffer.from(fetched.publicKey).equals(bytes)).toBe(true);
    expect(fetched.counter).toBe(5);
  });
});

describe("WebAuthnChallenge model", () => {
  it("enforces uniqueness of challenge", async () => {
    await Challenge.init();
    await Challenge.create({
      challenge: "abc",
      type: "registration",
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(
      Challenge.create({
        challenge: "abc",
        type: "authentication",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toThrow();
  });

  it("declares a TTL index on expiresAt", async () => {
    await Challenge.init();
    const indexes = await Challenge.collection.indexes();
    const ttl = indexes.find(
      (i) => i.key && i.key.expiresAt === 1 && i.expireAfterSeconds === 0,
    );
    expect(ttl).toBeDefined();
  });
});
