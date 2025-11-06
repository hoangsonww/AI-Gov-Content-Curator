// Mock the FilterPreset model
jest.mock("../models/filterPreset.model", () => {
  const FilterPreset = jest.fn(function (doc) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
  });
  FilterPreset.find = jest.fn();
  FilterPreset.findOne = jest.fn();
  FilterPreset.findOneAndDelete = jest.fn();
  return FilterPreset;
});
const FilterPreset = require("../models/filterPreset.model");

const {
  getFilterPresets,
  getFilterPresetById,
  createFilterPreset,
  updateFilterPreset,
  deleteFilterPreset,
} = require("../controllers/filterPreset.controller");

describe("Filter Preset Controller", () => {
  let req, res;

  const mockRequest = ({
    body = {},
    params = {},
    query = {},
    user = null,
  } = {}) => ({
    body,
    params,
    query,
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
    console.error = jest.fn();
    res = mockResponse();
  });

  describe("getFilterPresets()", () => {
    it("401 if user is not authenticated", async () => {
      req = mockRequest();
      await getFilterPresets(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("200 with list of presets for authenticated user", async () => {
      const mockPresets = [
        {
          _id: "preset1",
          userId: "user123",
          name: "My Filter",
          filters: { source: "state.gov" },
        },
        {
          _id: "preset2",
          userId: "user123",
          name: "Policy Articles",
          filters: { topic: "policy" },
        },
      ];

      FilterPreset.find.mockReturnValue({
        sort: jest.fn().mockResolvedValue(mockPresets),
      });

      req = mockRequest({ user: { userId: "user123" } });
      await getFilterPresets(req, res);

      expect(FilterPreset.find).toHaveBeenCalledWith({ userId: "user123" });
      expect(res.json).toHaveBeenCalledWith({ data: mockPresets });
    });

    it("500 on database error", async () => {
      FilterPreset.find.mockReturnValue({
        sort: jest.fn().mockRejectedValue(new Error("DB error")),
      });

      req = mockRequest({ user: { userId: "user123" } });
      await getFilterPresets(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: "Failed to fetch filter presets",
      });
    });
  });

  describe("getFilterPresetById()", () => {
    it("401 if user is not authenticated", async () => {
      req = mockRequest({ params: { id: "preset1" } });
      await getFilterPresetById(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("404 if preset not found or doesn't belong to user", async () => {
      FilterPreset.findOne.mockResolvedValue(null);

      req = mockRequest({
        params: { id: "preset1" },
        user: { userId: "user123" },
      });
      await getFilterPresetById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Filter preset not found",
      });
    });

    it("200 with preset data for authenticated user", async () => {
      const mockPreset = {
        _id: "preset1",
        userId: "user123",
        name: "My Filter",
        filters: { source: "state.gov" },
      };

      FilterPreset.findOne.mockResolvedValue(mockPreset);

      req = mockRequest({
        params: { id: "preset1" },
        user: { userId: "user123" },
      });
      await getFilterPresetById(req, res);

      expect(FilterPreset.findOne).toHaveBeenCalledWith({
        _id: "preset1",
        userId: "user123",
      });
      expect(res.json).toHaveBeenCalledWith(mockPreset);
    });
  });

  describe("createFilterPreset()", () => {
    it("401 if user is not authenticated", async () => {
      req = mockRequest({
        body: { name: "Test", filters: { source: "test" } },
      });
      await createFilterPreset(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("400 if name or filters are missing", async () => {
      req = mockRequest({
        body: { name: "Test" },
        user: { userId: "user123" },
      });
      await createFilterPreset(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Name and filters are required",
      });
    });

    it("409 if preset with same name already exists", async () => {
      FilterPreset.findOne.mockResolvedValue({
        _id: "existing",
        name: "Duplicate",
      });

      req = mockRequest({
        body: { name: "Duplicate", filters: { source: "test" } },
        user: { userId: "user123" },
      });
      await createFilterPreset(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: "A preset with this name already exists",
      });
    });

    it("201 on successful creation", async () => {
      FilterPreset.findOne.mockResolvedValue(null);

      const newPreset = {
        userId: "user123",
        name: "New Filter",
        filters: { source: "state.gov", topic: "policy" },
      };

      const mockSavedPreset = {
        _id: "newpreset",
        ...newPreset,
      };

      // Mock the constructor to return an object with save method
      FilterPreset.mockImplementation((doc) => {
        return {
          ...doc,
          save: jest.fn().mockResolvedValue(mockSavedPreset),
        };
      });

      req = mockRequest({
        body: newPreset,
        user: { userId: "user123" },
      });
      await createFilterPreset(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user123",
          name: "New Filter",
          filters: expect.objectContaining({
            source: "state.gov",
            topic: "policy",
          }),
        }),
      );
    });
  });

  describe("updateFilterPreset()", () => {
    it("401 if user is not authenticated", async () => {
      req = mockRequest({
        params: { id: "preset1" },
        body: { name: "Updated" },
      });
      await updateFilterPreset(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("404 if preset not found", async () => {
      FilterPreset.findOne.mockResolvedValue(null);

      req = mockRequest({
        params: { id: "preset1" },
        body: { name: "Updated" },
        user: { userId: "user123" },
      });
      await updateFilterPreset(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Filter preset not found",
      });
    });

    it("409 if new name already exists", async () => {
      const existingPreset = {
        _id: "preset1",
        userId: "user123",
        name: "Old Name",
        filters: {},
        save: jest.fn(),
      };
      FilterPreset.findOne
        .mockResolvedValueOnce(existingPreset) // First call returns the preset to update
        .mockResolvedValueOnce({ _id: "other", name: "New Name" }); // Second call finds duplicate

      req = mockRequest({
        params: { id: "preset1" },
        body: { name: "New Name" },
        user: { userId: "user123" },
      });
      await updateFilterPreset(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: "A preset with this name already exists",
      });
    });

    it("200 on successful update", async () => {
      const mockPreset = {
        _id: "preset1",
        userId: "user123",
        name: "Old Name",
        filters: { source: "old" },
        save: jest.fn().mockResolvedValue({
          _id: "preset1",
          userId: "user123",
          name: "New Name",
          filters: { source: "new" },
        }),
      };

      FilterPreset.findOne
        .mockResolvedValueOnce(mockPreset)
        .mockResolvedValueOnce(null); // No duplicate

      req = mockRequest({
        params: { id: "preset1" },
        body: { name: "New Name", filters: { source: "new" } },
        user: { userId: "user123" },
      });
      await updateFilterPreset(req, res);

      expect(mockPreset.save).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe("deleteFilterPreset()", () => {
    it("401 if user is not authenticated", async () => {
      req = mockRequest({ params: { id: "preset1" } });
      await deleteFilterPreset(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
    });

    it("404 if preset not found", async () => {
      FilterPreset.findOneAndDelete.mockResolvedValue(null);

      req = mockRequest({
        params: { id: "preset1" },
        user: { userId: "user123" },
      });
      await deleteFilterPreset(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: "Filter preset not found",
      });
    });

    it("200 on successful deletion", async () => {
      FilterPreset.findOneAndDelete.mockResolvedValue({
        _id: "preset1",
        name: "Deleted",
      });

      req = mockRequest({
        params: { id: "preset1" },
        user: { userId: "user123" },
      });
      await deleteFilterPreset(req, res);

      expect(FilterPreset.findOneAndDelete).toHaveBeenCalledWith({
        _id: "preset1",
        userId: "user123",
      });
      expect(res.json).toHaveBeenCalledWith({
        message: "Filter preset deleted successfully",
      });
    });
  });
});
