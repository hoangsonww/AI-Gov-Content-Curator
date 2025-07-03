const User = require("../models/user.model");
const Article = require("../models/article.model");
const {
  getFavoriteArticles,
  getFavoriteArticleIds,
  toggleFavoriteArticle,
  validateTokenController,
  searchFavoriteArticles,
  getAllUsers,
} = require("../controllers/user.controller");

jest.mock("../models/user.model");
jest.mock("../models/article.model");

describe("Favorite Controller", () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
  });

  describe("getFavoriteArticles", () => {
    it("404 if user not found", async () => {
      User.findById.mockResolvedValue(null);
      req = { user: { id: "u1" } };
      await getFavoriteArticles(req, res);
      expect(User.findById).toHaveBeenCalledWith("u1");
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
    });

    it("200 returns articles array on success", async () => {
      const user = { favorites: ["a1", "a2"] };
      const articles = [{ _id: "a1" }, { _id: "a2" }];
      User.findById.mockResolvedValue(user);
      Article.find.mockResolvedValue(articles);
      req = { user: { id: "u1" } };
      await getFavoriteArticles(req, res);
      expect(Article.find).toHaveBeenCalledWith({ _id: { $in: user.favorites } });
      expect(res.json).toHaveBeenCalledWith(articles);
    });

    it("500 on error", async () => {
      const err = new Error("db fail");
      User.findById.mockRejectedValue(err);
      console.error = jest.fn();
      req = { user: { id: "u1" } };
      await getFavoriteArticles(req, res);
      expect(console.error).toHaveBeenCalledWith("Error retrieving favorite articles:", err);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("getFavoriteArticleIds", () => {
    it("404 if user not found", async () => {
      User.findById.mockResolvedValue(null);
      req = { user: { id: "u1" } };
      await getFavoriteArticleIds(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
    });

    it("200 returns favorites array", async () => {
      const user = { favorites: ["x", "y"] };
      User.findById.mockResolvedValue(user);
      req = { user: { id: "u1" } };
      await getFavoriteArticleIds(req, res);
      expect(res.json).toHaveBeenCalledWith({ favorites: user.favorites });
    });

    it("500 on error", async () => {
      const err = new Error("oops");
      User.findById.mockRejectedValue(err);
      console.error = jest.fn();
      req = { user: { id: "u1" } };
      await getFavoriteArticleIds(req, res);
      expect(console.error).toHaveBeenCalledWith("Error retrieving favorites:", err);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("toggleFavoriteArticle", () => {
    it("400 if articleId missing", async () => {
      req = { body: {} };
      await toggleFavoriteArticle(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Article ID is required" });
    });

    it("404 if user not found", async () => {
      User.findById.mockResolvedValue(null);
      req = { user: { id: "u1" }, body: { articleId: "a1" } };
      await toggleFavoriteArticle(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
    });

    it("unfavorites when already in list", async () => {
      const user = { favorites: ["a1", "b"], save: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(user);
      req = { user: { id: "u1" }, body: { articleId: "a1" } };
      await toggleFavoriteArticle(req, res);
      expect(user.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Article unfavorited",
        favorites: ["b"],
      });
    });

    it("favorites when not already in list", async () => {
      const user = { favorites: ["b"], save: jest.fn().mockResolvedValue(true) };
      User.findById.mockResolvedValue(user);
      req = { user: { id: "u1" }, body: { articleId: "a1" } };
      await toggleFavoriteArticle(req, res);
      expect(user.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        message: "Article favorited",
        favorites: ["b", "a1"],
      });
    });

    it("500 on error", async () => {
      const err = new Error("fail");
      User.findById.mockRejectedValue(err);
      console.error = jest.fn();
      req = { user: { id: "u1" }, body: { articleId: "a1" } };
      await toggleFavoriteArticle(req, res);
      expect(console.error).toHaveBeenCalledWith("Error favoriting article:", err);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("validateTokenController", () => {
    it("always returns valid: true", async () => {
      req = {};
      await validateTokenController(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ valid: true });
    });
  });

  describe("searchFavoriteArticles", () => {
    const user = { favorites: ["a1", "a2"] };

    it("404 if user not found", async () => {
      User.findById.mockResolvedValue(null);
      req = { user: { id: "u1" }, query: {} };
      await searchFavoriteArticles(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "User not found" });
    });

    it("returns paginated data without q", async () => {
      User.findById.mockResolvedValue(user);
      const articles = [{ _id: "a1" }];
      const chain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(articles),
      };
      Article.find.mockReturnValue(chain);
      Article.countDocuments.mockResolvedValue(1);

      req = { user: { id: "u1" }, query: { page: "2", limit: "5" } };
      await searchFavoriteArticles(req, res);

      expect(Article.find).toHaveBeenCalledWith({ _id: { $in: user.favorites } });
      expect(chain.skip).toHaveBeenCalledWith((2 - 1) * 5);
      expect(chain.limit).toHaveBeenCalledWith(5);
      expect(res.json).toHaveBeenCalledWith({ data: articles, total: 1 });
    });

    it("applies q filter", async () => {
      User.findById.mockResolvedValue(user);
      const articles = [{ _id: "a1" }];
      const chain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(articles),
      };
      Article.find.mockReturnValue(chain);
      Article.countDocuments.mockResolvedValue(1);

      req = {
        user: { id: "u1" },
        query: { q: "foo", page: "1", limit: "2" },
      };
      await searchFavoriteArticles(req, res);

      expect(Article.find).toHaveBeenCalledWith({
        _id: { $in: user.favorites },
        $or: [
          { title: { $regex: "foo", $options: "i" } },
          { summary: { $regex: "foo", $options: "i" } },
        ],
      });
      expect(res.json).toHaveBeenCalledWith({ data: articles, total: 1 });
    });

    it("500 on error", async () => {
      const err = new Error("fail");
      User.findById.mockResolvedValue(user);
      Article.find.mockImplementation(() => { throw err; });
      req = { user: { id: "u1" }, query: {} };
      await searchFavoriteArticles(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });

  describe("getAllUsers", () => {
    it("returns list of users", async () => {
      const users = [{ _id: "u1", username: "x", name: "X" }];
      const chain = {
        select: jest.fn().mockReturnThis(),
        sort: jest.fn().mockResolvedValue(users),
      };
      User.find.mockReturnValue(chain);
      req = {};
      await getAllUsers(req, res);
      expect(User.find).toHaveBeenCalledWith();
      expect(chain.select).toHaveBeenCalledWith("_id username name");
      expect(chain.sort).toHaveBeenCalledWith({ username: 1 });
      expect(res.json).toHaveBeenCalledWith({ data: users });
    });

    it("500 on error", async () => {
      const err = new Error("oops");
      User.find.mockImplementation(() => { throw err; });
      console.error = jest.fn();
      req = {};
      await getAllUsers(req, res);
      expect(console.error).toHaveBeenCalledWith("Error retrieving all users:", err);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
    });
  });
});
