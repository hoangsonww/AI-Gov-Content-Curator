// 1) Mock the NewsletterSubscriber module
jest.mock("../models/newsletterSubscriber.model", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndDelete: jest.fn(),
}));
const NewsletterSubscriber = require("../models/newsletterSubscriber.model");

// 2) Import the controller
const { subscribe, unsubscribe } = require("../controllers/newsletter.controller");

describe("Newsletter Controller", () => {
  let req, res, statusMock, jsonMock;

  beforeEach(() => {
    jest.clearAllMocks();
    // silence any console.error in the controller
    console.error = jest.fn();

    statusMock = jest.fn().mockReturnThis();
    jsonMock = jest.fn().mockReturnThis();
    res = { status: statusMock, json: jsonMock };
  });

  describe("subscribe()", () => {
    it("400 when email missing", async () => {
      req = { body: {} };
      await subscribe(req, res);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalled();
    });

    it("400 when email invalid", async () => {
      req = { body: { email: "not-an-email" } };
      await subscribe(req, res);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("200 when already subscribed", async () => {
      NewsletterSubscriber.findOne.mockResolvedValue({}); // simulate exists
      req = { body: { email: "x@y.com" } };
      await subscribe(req, res);
      expect(NewsletterSubscriber.findOne).toHaveBeenCalledWith({ email: "x@y.com" });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalled();
    });

    it("201 when newly subscribed", async () => {
      NewsletterSubscriber.findOne.mockResolvedValue(null);
      NewsletterSubscriber.create.mockResolvedValue({});
      req = { body: { email: "NEW@Y.COM" } };
      await subscribe(req, res);
      expect(NewsletterSubscriber.findOne).toHaveBeenCalledWith({ email: "new@y.com" });
      expect(NewsletterSubscriber.create).toHaveBeenCalledWith({ email: "new@y.com" });
      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalled();
    });

    it("500 on internal error", async () => {
      NewsletterSubscriber.findOne.mockRejectedValue(new Error("uh-oh"));
      req = { body: { email: "x@y.com" } };
      await subscribe(req, res);
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalled();
    });
  });

  describe("unsubscribe()", () => {
    it("400 when email missing", async () => {
      req = { method: "POST", body: {}, query: {} };
      await unsubscribe(req, res);
      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalled();
    });

    it("400 when email invalid", async () => {
      req = { method: "GET", body: {}, query: { email: "nope" } };
      await unsubscribe(req, res);
      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("404 when not subscribed", async () => {
      NewsletterSubscriber.findOneAndDelete.mockResolvedValue(null);
      req = { method: "GET", body: {}, query: { email: "x@y.com" } };
      await unsubscribe(req, res);
      expect(NewsletterSubscriber.findOneAndDelete).toHaveBeenCalledWith({ email: "x@y.com" });
      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalled();
    });

    it("200 on successful unsubscribe", async () => {
      NewsletterSubscriber.findOneAndDelete.mockResolvedValue({});
      req = { method: "POST", body: { email: "X@Y.COM" }, query: {} };
      await unsubscribe(req, res);
      // normalization lowercases back to "x@y.com"
      expect(NewsletterSubscriber.findOneAndDelete).toHaveBeenCalledWith({ email: "x@y.com" });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalled();
    });

    it("500 on internal error", async () => {
      NewsletterSubscriber.findOneAndDelete.mockRejectedValue(new Error("boom"));
      req = { method: "GET", body: {}, query: { email: "x@y.com" } };
      await unsubscribe(req, res);
      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalled();
    });
  });
});
