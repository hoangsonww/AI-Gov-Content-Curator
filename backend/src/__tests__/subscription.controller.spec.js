// Mock the Subscription model
jest.mock("../models/subscription.model", () => {
  const Subscription = jest.fn(function (doc) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
    this._id = "mockId123";
  });
  Subscription.find = jest.fn();
  Subscription.findOne = jest.fn();
  Subscription.findOneAndUpdate = jest.fn();
  Subscription.findOneAndDelete = jest.fn();
  Subscription.prototype.save = jest.fn().mockResolvedValue(this);
  return Subscription;
});

// Mock the User model
jest.mock("../models/user.model", () => {
  const User = jest.fn(function (doc) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
  });
  User.create = jest.fn();
  User.findOne = jest.fn();
  User.findById = jest.fn();
  return User;
});

const Subscription = require("../models/subscription.model");
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");

const {
  getUserSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  getSubscription,
} = require("../controllers/subscription.controller");

describe("Subscription Controller", () => {
  let req, res;
  const userId = "testUserId123";
  const authToken = jwt.sign({ id: userId }, process.env.JWT_SECRET || "test_secret");

  const mockRequest = ({ body = {}, params = {}, user = { id: userId } } = {}) => ({
    body,
    params,
    user,
  });

  const mockResponse = () => {
    const r = {};
    r.status = jest.fn().mockReturnValue(r);
    r.json = jest.fn().mockReturnValue(r);
    return r;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    res = mockResponse();
  });

  describe("createSubscription", () => {
    it("should create a new subscription", async () => {
      const subscriptionData = {
        topics: ["politics", "economy"],
        keywords: ["budget", "policy"],
        sources: ["whitehouse.gov"],
        mode: "realtime",
        emailEnabled: true,
        pushEnabled: false,
      };

      const mockSubscription = {
        ...subscriptionData,
        userId,
        _id: "mockId123",
        save: jest.fn().mockResolvedValue({
          ...subscriptionData,
          userId,
          _id: "mockId123",
        }),
      };

      Subscription.mockImplementation(() => mockSubscription);

      req = mockRequest({ body: subscriptionData });
      await createSubscription(req, res);

      expect(mockSubscription.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        ...subscriptionData,
        userId,
        _id: "mockId123",
      });
    });

    it("should create a subscription with default values", async () => {
      const defaultValues = {
        userId,
        topics: [],
        keywords: [],
        sources: [],
        mode: "realtime",
        emailEnabled: true,
        pushEnabled: false,
        _id: "mockId123",
      };

      const mockSubscription = {
        ...defaultValues,
        save: jest.fn().mockResolvedValue(defaultValues),
      };

      Subscription.mockImplementation(() => mockSubscription);

      req = mockRequest({ body: {} });
      await createSubscription(req, res);

      expect(mockSubscription.save).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(defaultValues);
    });

    it("should reject invalid mode", async () => {
      req = mockRequest({ body: { mode: "invalid" } });
      await createSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ 
        error: "Mode must be either 'realtime' or 'daily'" 
      });
    });

    it("should require authentication", async () => {
      req = mockRequest({ user: null });
      await createSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });
  });

  describe("getUserSubscriptions", () => {
    it("should get all user subscriptions", async () => {
      const mockSubscriptions = [
        { userId, topics: ["politics"], mode: "realtime" },
        { userId, topics: ["economy"], mode: "daily" },
      ];

      Subscription.find.mockResolvedValue(mockSubscriptions);

      req = mockRequest();
      await getUserSubscriptions(req, res);

      expect(Subscription.find).toHaveBeenCalledWith({ userId });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockSubscriptions);
    });

    it("should require authentication", async () => {
      req = mockRequest({ user: null });
      await getUserSubscriptions(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });
  });

  describe("updateSubscription", () => {
    it("should update a subscription", async () => {
      const subscriptionId = "subscriptionId123";
      const updateData = {
        topics: ["economy", "healthcare"],
        mode: "daily",
        emailEnabled: false,
      };

      const updatedSubscription = {
        _id: subscriptionId,
        userId,
        ...updateData,
      };

      Subscription.findOneAndUpdate.mockResolvedValue(updatedSubscription);

      req = mockRequest({ 
        params: { id: subscriptionId }, 
        body: updateData 
      });
      await updateSubscription(req, res);

      expect(Subscription.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: subscriptionId, userId },
        updateData,
        { new: true }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(updatedSubscription);
    });

    it("should return 404 for non-existent subscription", async () => {
      const subscriptionId = "nonExistentId";
      Subscription.findOneAndUpdate.mockResolvedValue(null);

      req = mockRequest({ 
        params: { id: subscriptionId }, 
        body: { topics: ["test"] } 
      });
      await updateSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Subscription not found" });
    });
  });

  describe("deleteSubscription", () => {
    it("should delete a subscription", async () => {
      const subscriptionId = "subscriptionId123";
      const deletedSubscription = { _id: subscriptionId, userId };

      Subscription.findOneAndDelete.mockResolvedValue(deletedSubscription);

      req = mockRequest({ params: { id: subscriptionId } });
      await deleteSubscription(req, res);

      expect(Subscription.findOneAndDelete).toHaveBeenCalledWith({ 
        _id: subscriptionId, 
        userId 
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ 
        message: "Subscription deleted successfully" 
      });
    });

    it("should return 404 for non-existent subscription", async () => {
      const subscriptionId = "nonExistentId";
      Subscription.findOneAndDelete.mockResolvedValue(null);

      req = mockRequest({ params: { id: subscriptionId } });
      await deleteSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Subscription not found" });
    });
  });

  describe("getSubscription", () => {
    it("should get a specific subscription", async () => {
      const subscriptionId = "subscriptionId123";
      const subscription = { 
        _id: subscriptionId, 
        userId, 
        topics: ["politics"], 
        mode: "realtime" 
      };

      Subscription.findOne.mockResolvedValue(subscription);

      req = mockRequest({ params: { id: subscriptionId } });
      await getSubscription(req, res);

      expect(Subscription.findOne).toHaveBeenCalledWith({ 
        _id: subscriptionId, 
        userId 
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(subscription);
    });

    it("should return 404 for non-existent subscription", async () => {
      const subscriptionId = "nonExistentId";
      Subscription.findOne.mockResolvedValue(null);

      req = mockRequest({ params: { id: subscriptionId } });
      await getSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Subscription not found" });
    });
  });
});