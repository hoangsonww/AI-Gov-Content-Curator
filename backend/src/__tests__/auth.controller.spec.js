// 1) Stub out the User model as a jest.fn constructor with static methods
jest.mock("../models/user.model", () => {
  const User = jest.fn(function (doc) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
  });
  User.findOne = jest.fn();
  User.findById = jest.fn();
  return User;
});
const User = require("../models/user.model");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const {
  register,
  login,
  verifyEmail,
  resetPasswordRequest,
  confirmResetPassword,
} = require("../controllers/auth.controller");

describe("Auth Controller", () => {
  let req, res;

  const mockRequest = ({ body = {}, params = {}, query = {} } = {}) => ({
    body,
    params,
    query,
  });

  const mockResponse = () => {
    const r = {};
    r.status = jest.fn().mockReturnValue(r);
    r.json = jest.fn().mockReturnValue(r);
    r.setHeader = jest.fn();
    return r;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    console.error = jest.fn();
    res = mockResponse();
  });

  describe("register()", () => {
    it("400 if user already exists", async () => {
      User.findOne.mockResolvedValue({ _id: "exists" });
      req = mockRequest({ body: { email: "a@b.com", password: "p", name: "N" } });
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it("201 on successful registration", async () => {
      User.findOne.mockResolvedValue(null);
      bcrypt.hash = jest.fn().mockResolvedValue("hashedpass");
      jest.spyOn(crypto, "randomBytes").mockReturnValue(Buffer.from("abcdef", "hex"));
      jwt.sign = jest.fn().mockReturnValue("jwt-token");

      req = mockRequest({ body: { email: "a@b.com", password: "pw", name: "N" } });
      await register(req, res);

      expect(res.setHeader).toHaveBeenCalledWith("Authorization", "jwt-token");
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
    });

    it("500 on internal error", async () => {
      User.findOne.mockRejectedValue(new Error("boom"));
      req = mockRequest({ body: { email: "x@b.com", password: "pw", name: "X" } });
      await register(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("login()", () => {
    it("400 for nonexistent user", async () => {
      User.findOne.mockResolvedValue(null);
      req = mockRequest({ body: { email: "a@b.com", password: "pw" } });
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it("400 for wrong password", async () => {
      User.findOne.mockResolvedValue({ password: "hashed" });
      bcrypt.compare = jest.fn().mockResolvedValue(false);
      req = mockRequest({ body: { email: "a@b.com", password: "wrong" } });
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it("200 on successful login", async () => {
      User.findOne.mockResolvedValue({ password: "hashed", _id: "u2", email: "a@b.com", name: "N", isVerified: true });
      bcrypt.compare = jest.fn().mockResolvedValue(true);
      jwt.sign = jest.fn().mockReturnValue("jwt-token-2");
      req = mockRequest({ body: { email: "a@b.com", password: "pw" } });
      await login(req, res);
      expect(res.setHeader).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it("500 on internal error", async () => {
      User.findOne.mockRejectedValue(new Error("boom"));
      req = mockRequest({ body: { email: "a@b.com", password: "pw" } });
      await login(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("verifyEmail()", () => {
    it("400 if missing params", async () => {
      req = mockRequest({ query: {} });
      await verifyEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it("400 if invalid token", async () => {
      User.findOne.mockResolvedValue(null);
      req = mockRequest({ query: { email: "x@x.com", token: "bad" } });
      await verifyEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it("200 on success", async () => {
      const user = { verificationToken: "tok", isVerified: false, save: jest.fn().mockResolvedValue(true) };
      User.findOne.mockResolvedValue(user);
      req = mockRequest({ query: { email: "x@x.com", token: "tok" } });
      await verifyEmail(req, res);
      expect(res.json).toHaveBeenCalled();
    });

    it("500 on internal error", async () => {
      User.findOne.mockRejectedValue(new Error("boom"));
      req = mockRequest({ query: { email: "x@x.com", token: "tok" } });
      await verifyEmail(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("resetPasswordRequest()", () => {
    it("400 if no email", async () => {
      req = mockRequest({ body: {} });
      await resetPasswordRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it("400 if user not found", async () => {
      User.findOne.mockResolvedValue(null);
      req = mockRequest({ body: { email: "x@x.com" } });
      await resetPasswordRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it("200 on token gen", async () => {
      const user = { save: jest.fn().mockResolvedValue(true) };
      User.findOne.mockResolvedValue(user);
      jest.spyOn(crypto, "randomBytes").mockReturnValue(Buffer.from("123456", "hex"));
      req = mockRequest({ body: { email: "x@x.com" } });
      await resetPasswordRequest(req, res);
      expect(user.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it("500 on internal error", async () => {
      User.findOne.mockRejectedValue(new Error("boom"));
      req = mockRequest({ body: { email: "x@x.com" } });
      await resetPasswordRequest(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("confirmResetPassword()", () => {
    it("400 if missing fields", async () => {
      req = mockRequest({ body: { email: "a@b.com", token: "tkn" } });
      await confirmResetPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it("400 if invalid token/email", async () => {
      User.findOne.mockResolvedValue(null);
      req = mockRequest({ body: { email: "a@b.com", token: "tkn", newPassword: "np" } });
      await confirmResetPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
    });

    it("200 on success", async () => {
      const user = { save: jest.fn().mockResolvedValue(true) };
      bcrypt.hash = jest.fn().mockResolvedValue("newHash");
      User.findOne.mockResolvedValue(user);
      req = mockRequest({ body: { email: "a@b.com", token: "tkn", newPassword: "np" } });
      await confirmResetPassword(req, res);
      expect(user.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });

    it("500 on internal error", async () => {
      User.findOne.mockRejectedValue(new Error("boom"));
      req = mockRequest({ body: { email: "a@b.com", token: "tkn", newPassword: "np" } });
      await confirmResetPassword(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalled();
    });
  });
});
