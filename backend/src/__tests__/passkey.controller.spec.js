// Mock User model
jest.mock("../models/user.model", () => {
  const User = jest.fn(function (doc) {
    Object.assign(this, doc);
    this._id = this._id || "u1";
    this.save = jest.fn().mockResolvedValue(this);
  });
  User.findOne = jest.fn();
  User.findById = jest.fn();
  return User;
});

// Mock Passkey model
jest.mock("../models/passkey.model", () => {
  const Passkey = jest.fn();
  Passkey.find = jest.fn();
  Passkey.findOne = jest.fn();
  Passkey.findById = jest.fn();
  Passkey.create = jest.fn();
  Passkey.countDocuments = jest.fn();
  return Passkey;
});

// Mock WebAuthnChallenge model
jest.mock("../models/webauthn-challenge.model", () => {
  const Challenge = jest.fn();
  Challenge.create = jest.fn();
  Challenge.findOne = jest.fn();
  return Challenge;
});

// Mock the webauthn service
jest.mock("../services/webauthn.service", () => ({
  RP_ID: "localhost",
  RP_NAME: "Test",
  RP_ORIGINS: ["http://localhost:3000"],
  CHALLENGE_TTL_MS: 5 * 60 * 1000,
  generateRegistrationOptions: jest
    .fn()
    .mockResolvedValue({ challenge: "ch-reg" }),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest
    .fn()
    .mockResolvedValue({ challenge: "ch-auth" }),
  verifyAuthenticationResponse: jest.fn(),
}));

jest.mock("../services/auth-token.service", () => ({
  signJwt: jest.fn().mockReturnValue("jwt-token"),
}));

const User = require("../models/user.model");
const Passkey = require("../models/passkey.model");
const Challenge = require("../models/webauthn-challenge.model");
const webauthn = require("../services/webauthn.service");

const {
  beginRegistration,
  verifyRegistration,
  beginAuthentication,
  verifyAuthentication,
  beginSignup,
  verifySignup,
  listPasskeys,
  renamePasskey,
  deletePasskey,
} = require("../controllers/passkey.controller");

const mockReq = ({ body = {}, params = {}, query = {}, user } = {}) => ({
  body,
  params,
  query,
  user,
});

const mockRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json = jest.fn().mockReturnValue(r);
  r.setHeader = jest.fn();
  return r;
};

const buildClientDataJSON = (challenge) =>
  Buffer.from(JSON.stringify({ challenge }), "utf8").toString("base64");

describe("Passkey Controller", () => {
  let res;

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    res = mockRes();
  });

  describe("beginRegistration()", () => {
    it("401 when unauthenticated", async () => {
      await beginRegistration(mockReq({}), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("404 when user missing", async () => {
      User.findById.mockResolvedValue(null);
      await beginRegistration(
        mockReq({ user: { id: "u1", email: "a@b.com" } }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("returns options and persists challenge", async () => {
      User.findById.mockResolvedValue({
        _id: "u1",
        email: "a@b.com",
        name: "N",
      });
      Passkey.find.mockResolvedValue([]);
      Challenge.create.mockResolvedValue({});
      await beginRegistration(
        mockReq({ user: { id: "u1", email: "a@b.com" } }),
        res,
      );
      expect(webauthn.generateRegistrationOptions).toHaveBeenCalled();
      expect(Challenge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge: "ch-reg",
          type: "registration",
          userId: "u1",
        }),
      );
      expect(res.json).toHaveBeenCalledWith({ challenge: "ch-reg" });
    });
  });

  describe("verifyRegistration()", () => {
    it("400 when challenge not found", async () => {
      Challenge.findOne.mockResolvedValue(null);
      await verifyRegistration(
        mockReq({
          user: { id: "u1", email: "a@b.com" },
          body: {
            response: {
              response: { clientDataJSON: buildClientDataJSON("ch-reg") },
            },
          },
        }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("400 when challenge expired", async () => {
      Challenge.findOne.mockResolvedValue({
        expiresAt: new Date(Date.now() - 1000),
        deleteOne: jest.fn(),
      });
      await verifyRegistration(
        mockReq({
          user: { id: "u1", email: "a@b.com" },
          body: {
            response: {
              response: { clientDataJSON: buildClientDataJSON("ch-reg") },
            },
          },
        }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("201 on successful verification", async () => {
      Challenge.findOne.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        deleteOne: jest.fn(),
      });
      webauthn.verifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: "cred-id",
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
          },
          credentialDeviceType: "multiDevice",
          credentialBackedUp: true,
        },
      });
      User.findById.mockResolvedValue({
        _id: "u1",
        email: "a@b.com",
        save: jest.fn().mockResolvedValue(true),
      });
      Passkey.create.mockResolvedValue({
        _id: "pk1",
        nickname: "Test",
        createdAt: new Date(),
        deviceType: "multiDevice",
        backedUp: true,
      });

      await verifyRegistration(
        mockReq({
          user: { id: "u1", email: "a@b.com" },
          body: {
            response: {
              response: { clientDataJSON: buildClientDataJSON("ch-reg") },
            },
            nickname: "Test",
          },
        }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(Passkey.create).toHaveBeenCalled();
    });
  });

  describe("beginAuthentication()", () => {
    it("returns options and persists challenge", async () => {
      Challenge.create.mockResolvedValue({});
      await beginAuthentication(mockReq({}), res);
      expect(webauthn.generateAuthenticationOptions).toHaveBeenCalled();
      expect(Challenge.create).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ challenge: "ch-auth" });
    });
  });

  describe("verifyAuthentication()", () => {
    it("400 when credential unknown", async () => {
      Challenge.findOne.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        deleteOne: jest.fn(),
      });
      Passkey.findOne.mockResolvedValue(null);
      await verifyAuthentication(
        mockReq({
          body: {
            response: {
              id: "cred-id",
              response: { clientDataJSON: buildClientDataJSON("ch-auth") },
            },
          },
        }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("issues JWT on successful verification", async () => {
      Challenge.findOne.mockResolvedValue({
        expiresAt: new Date(Date.now() + 60_000),
        deleteOne: jest.fn(),
      });
      Passkey.findOne.mockResolvedValue({
        credentialId: "cred-id",
        publicKey: Buffer.from([1, 2, 3]),
        counter: 0,
        transports: ["internal"],
        userId: "u1",
        save: jest.fn().mockResolvedValue(true),
      });
      webauthn.verifyAuthenticationResponse.mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });
      User.findById.mockResolvedValue({
        _id: "u1",
        email: "a@b.com",
        name: "N",
        isVerified: true,
      });
      await verifyAuthentication(
        mockReq({
          body: {
            response: {
              id: "cred-id",
              response: { clientDataJSON: buildClientDataJSON("ch-auth") },
            },
          },
        }),
        res,
      );
      expect(res.setHeader).toHaveBeenCalledWith("Authorization", "jwt-token");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ token: "jwt-token" }),
      );
    });
  });

  describe("beginSignup()", () => {
    it("400 when email missing", async () => {
      await beginSignup(mockReq({ body: {} }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("400 when user already exists", async () => {
      User.findOne.mockResolvedValue({ _id: "exists" });
      await beginSignup(mockReq({ body: { email: "a@b.com" } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns options without creating a user", async () => {
      User.findOne.mockResolvedValue(null);
      Challenge.create.mockResolvedValue({});
      await beginSignup(
        mockReq({ body: { email: "a@b.com", name: "N" } }),
        res,
      );
      // User constructor must NOT be invoked at begin time — user is created on verify.
      expect(User).not.toHaveBeenCalled();
      expect(webauthn.generateRegistrationOptions).toHaveBeenCalled();
      expect(Challenge.create).toHaveBeenCalledWith(
        expect.objectContaining({
          challenge: "ch-reg",
          type: "registration",
          email: "a@b.com",
        }),
      );
      expect(res.json).toHaveBeenCalledWith({ challenge: "ch-reg" });
    });
  });

  describe("listPasskeys()", () => {
    it("401 when unauthenticated", async () => {
      await listPasskeys(mockReq({}), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it("returns shaped passkeys", async () => {
      Passkey.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue([
          {
            _id: "pk1",
            nickname: "iPhone",
            createdAt: new Date(),
            lastUsedAt: null,
            deviceType: "multiDevice",
            backedUp: true,
          },
        ]),
      });
      await listPasskeys(
        mockReq({ user: { id: "u1", email: "a@b.com" } }),
        res,
      );
      expect(res.json).toHaveBeenCalled();
      const out = res.json.mock.calls[0][0];
      expect(Array.isArray(out)).toBe(true);
      expect(out[0]).toEqual(
        expect.objectContaining({ id: "pk1", nickname: "iPhone" }),
      );
    });
  });

  describe("renamePasskey()", () => {
    it("400 when nickname missing", async () => {
      await renamePasskey(
        mockReq({
          user: { id: "u1", email: "a@b.com" },
          params: { id: "pk1" },
          body: {},
        }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("404 when passkey not found", async () => {
      Passkey.findOne.mockResolvedValue(null);
      await renamePasskey(
        mockReq({
          user: { id: "u1", email: "a@b.com" },
          params: { id: "pk1" },
          body: { nickname: "X" },
        }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("renames", async () => {
      Passkey.findOne.mockResolvedValue({
        _id: "pk1",
        nickname: "Old",
        save: jest.fn().mockResolvedValue(true),
      });
      await renamePasskey(
        mockReq({
          user: { id: "u1", email: "a@b.com" },
          params: { id: "pk1" },
          body: { nickname: "New" },
        }),
        res,
      );
      expect(res.json).toHaveBeenCalledWith({ id: "pk1", nickname: "New" });
    });
  });

  describe("deletePasskey()", () => {
    it("404 when passkey not found", async () => {
      Passkey.findOne.mockResolvedValue(null);
      await deletePasskey(
        mockReq({
          user: { id: "u1", email: "a@b.com" },
          params: { id: "pk1" },
        }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it("400 when deleting last passkey on passwordless account", async () => {
      Passkey.findOne.mockResolvedValue({
        _id: "pk1",
        deleteOne: jest.fn(),
      });
      User.findById.mockResolvedValue({
        _id: "u1",
        password: undefined,
        save: jest.fn(),
      });
      Passkey.countDocuments.mockResolvedValue(1);
      await deletePasskey(
        mockReq({
          user: { id: "u1", email: "a@b.com" },
          params: { id: "pk1" },
        }),
        res,
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("deletes successfully when password exists", async () => {
      const passkey = { _id: "pk1", deleteOne: jest.fn() };
      Passkey.findOne.mockResolvedValue(passkey);
      User.findById.mockResolvedValue({
        _id: "u1",
        password: "hashed",
        save: jest.fn().mockResolvedValue(true),
      });
      Passkey.countDocuments.mockResolvedValue(2);
      await deletePasskey(
        mockReq({
          user: { id: "u1", email: "a@b.com" },
          params: { id: "pk1" },
        }),
        res,
      );
      expect(passkey.deleteOne).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
