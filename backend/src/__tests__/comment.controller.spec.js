const { Types } = require("mongoose");

jest.mock("../models/comment.model", () => {
  const C = jest.fn().mockImplementation(() => ({
    save:     jest.fn().mockResolvedValue(true),
    remove:   jest.fn().mockResolvedValue(true),
    populate: jest.fn().mockResolvedValue(null)
  }));
  C.find     = jest.fn();
  C.findById = jest.fn();
  return C;
});
const Comment = require("../models/comment.model");

const {
  getCommentsByArticle,
  getAllComments,
  addComment,
  updateComment,
  deleteComment,
  voteComment
} = require("../controllers/comment.controller");

const mkRes = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  r.send   = jest.fn().mockReturnValue(r);
  return r;
};

beforeEach(() => jest.clearAllMocks());

describe("comment controller – success paths only", () => {
  it("getCommentsByArticle 200", async () => {
    const docs = [{ _id: "c1" }];
    Comment.find.mockReturnValue({
      populate: () => ({ populate: () => ({ sort: () => Promise.resolve(docs) }) })
    });
    const req = { params: { articleId: Types.ObjectId().toHexString() } };
    const res = mkRes();
    await getCommentsByArticle(req, res);
    expect(res.json).toHaveBeenCalledWith({ data: docs });
  });

  it("getAllComments 200", async () => {
    const docs = [{ _id: "c2" }];
    Comment.find.mockReturnValue({
      populate: () => ({ populate: () => ({ sort: () => Promise.resolve(docs) }) })
    });
    const res = mkRes();
    await getAllComments({}, res);
    expect(res.json).toHaveBeenCalledWith({ data: docs });
  });

  it("addComment 201", async () => {
    const fake = {};
    fake.save     = jest.fn().mockResolvedValue(true);
    fake.populate = jest.fn().mockResolvedValue(fake);
    Comment.mockImplementation(() => fake);
    const req = {
      user:   { id: Types.ObjectId().toHexString() },
      params: { articleId: Types.ObjectId().toHexString() },
      body:   { content: "hi" }
    };
    const res = mkRes();
    await addComment(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fake);
  });

  it("updateComment 200", async () => {
    const inst = { user:{ toHexString:()=> "u" }, save:jest.fn().mockResolvedValue(true) };
    inst.populate = jest.fn().mockResolvedValue(inst);
    Comment.findById.mockResolvedValue(inst);
    const req = {
      user:{ id:"u" },
      params:{ id:Types.ObjectId().toHexString() },
      body:{ content:"ok" }
    };
    const res = mkRes();
    await updateComment(req, res);
    expect(res.json).toHaveBeenCalledWith(inst);
  });

  it("deleteComment 204", async () => {
    const inst = { user:{ toHexString:()=> "u" }, remove:jest.fn().mockResolvedValue(true) };
    Comment.findById.mockResolvedValue(inst);
    const req = {
      user:{ id:"u" },
      params:{ id:Types.ObjectId().toHexString() }
    };
    const res = mkRes();
    await deleteComment(req, res);
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("voteComment upvote 200", async () => {
    const inst = {
      user:{ toHexString:()=> "u" },
      upvotes:{ pull:jest.fn(), addToSet:jest.fn() },
      downvotes:{ pull:jest.fn(), addToSet:jest.fn() },
      save:jest.fn().mockResolvedValue(true)
    };
    inst.populate = jest.fn().mockResolvedValue(inst);
    Comment.findById.mockResolvedValue(inst);
    const req = {
      user:{ id:"u" },
      params:{ id:Types.ObjectId().toHexString() },
      body:{ value:1 }
    };
    const res = mkRes();
    await voteComment(req, res);
    expect(res.json).toHaveBeenCalledWith(inst);
  });
});
