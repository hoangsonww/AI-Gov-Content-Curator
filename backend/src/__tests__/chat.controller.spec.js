// 1. Mock @google/generative-ai so askGemini uses our stubbed model
const sendMessageMock = jest.fn();
const startChatMock = jest
  .fn()
  .mockReturnValue({ sendMessage: sendMessageMock });
const getGenerativeModelMock = jest
  .fn()
  .mockReturnValue({ startChat: startChatMock });
const GoogleGenerativeAI = jest.fn().mockImplementation(() => ({
  getGenerativeModel: getGenerativeModelMock,
}));
const cacheGetMock = jest.fn();
const cacheSetMock = jest.fn();
const getSemanticCacheMock = jest.fn().mockReturnValue({ 
  get: cacheGetMock, 
  set: cacheSetMock 
});

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI,
  GenerationConfig: {}, // not used in tests
  HarmCategory: { HARASSMENT: 0 },
  HarmBlockThreshold: { BLOCK_NONE: 0 },
}));

jest.mock("../services/semanticCache.service", () => ({
  getSemanticCache: getSemanticCacheMock,
  SemanticCache: jest.fn(),
}));

// now import after mocks
const { handleChat, getAggMetrics } = require("../controllers/chat.controller");

describe("chat.controller – handleChat", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    cacheGetMock.mockReset();
    cacheSetMock.mockReset();

    // mock req/res/next
    req = { user: { id: "u1" }, body: { } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  it("returns 400 if article or userMessage missing", async () => {
    // missing both
    await handleChat(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "`article` and `userMessage` are required.",
    });

    // missing userMessage only
    req.body.article = { title: "T", content: "C" };
    req.body.userMessage = undefined;
    await handleChat(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "`article` and `userMessage` are required.",
    });
  });

  it("invokes askGemini on cache miss and returns reply on success", async () => {
    // stub sendMessage to resolve a response
    sendMessageMock.mockResolvedValue({
      response: { text: () => " Hello from Gemini " },
    });

    cacheGetMock.mockResolvedValue(null);

    req.body.article = { _id: "article1", title: "Title", content: "Some content" };
    req.body.userMessage = "Hi there";
    req.body.history = [{ role: "user", text: "hey" }];

    await handleChat(req, res, next);

    expect(getSemanticCacheMock).toHaveBeenCalled();
    expect(cacheGetMock).toHaveBeenCalledWith("u1", "article1", "Hi there");
    expect(cacheSetMock).toHaveBeenCalledWith(
      "u1",
      "article1",
      "Hi there",
      "Hello from Gemini",
    );
    expect(GoogleGenerativeAI).toHaveBeenCalled();
    expect(getGenerativeModelMock).toHaveBeenCalled();
    expect(startChatMock).toHaveBeenCalledWith({
      generationConfig: expect.any(Object),
      safetySettings: expect.any(Array),
      history: [{ role: "user", parts: [{ text: "hey" }] }],
    });
    expect(sendMessageMock).toHaveBeenCalledWith("Hi there");

    // trimmed reply
    expect(res.json).toHaveBeenCalledWith({ reply: "Hello from Gemini" });
  });

  it("does not call Gemini when cache hits", async () => {
    cacheGetMock.mockResolvedValue("cached response");

    req.body.article = { _id: "article1", title: "Title", content: "Some content" };
    req.body.userMessage = "Hi there";

    await handleChat(req, res, next);

    expect(getSemanticCacheMock).toHaveBeenCalled();
    expect(cacheGetMock).toHaveBeenCalledWith("u1", "article1", "Hi there");
    expect(cacheSetMock).not.toHaveBeenCalled();
    expect(GoogleGenerativeAI).not.toHaveBeenCalled();
    expect(getGenerativeModelMock).not.toHaveBeenCalled();
    expect(startChatMock).not.toHaveBeenCalledWith();
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ reply: "cached response" });
  });

  it("passes errors to next() if askGemini throws", async () => {
    // make sendMessage throw
    sendMessageMock.mockRejectedValue(new Error("API down"));

    req.body.article = { title: "T", content: "C" };
    req.body.userMessage = "Q";

    await handleChat(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    // no JSON or status called
    expect(res.json).not.toHaveBeenCalled();
  });

  it("p95 latency and mean tokens per request decreases for repeated intents", async () => {
    sendMessageMock.mockImplementation(() => {
      return new Promise((resolve) => setTimeout(() => resolve({
        response: { text: () => " Hello from Gemini " }
      }), 1000));}
    )

    cacheGetMock.mockResolvedValue(null);

    req.body.article = { _id: "article1", title: "Title", content: "Some content" };
    req.body.userMessage = "Hi there";
    req.body.history = [{ role: "user", text: "hey" }];

    await handleChat(req, res, next);

    expect(cacheGetMock).toHaveBeenCalled();
    expect(cacheSetMock).toHaveBeenCalled();
    expect(GoogleGenerativeAI).toHaveBeenCalled();

    const { p95Latency, meanTokensPerRequest } = getAggMetrics();

    jest.clearAllMocks();

    cacheGetMock.mockResolvedValue("cached response");

    await handleChat(req, res, next);

    expect(cacheGetMock).toHaveBeenCalled();
    expect(cacheSetMock).not.toHaveBeenCalled();
    expect(GoogleGenerativeAI).not.toHaveBeenCalled();

    const { p95Latency: newP95Latency, 
      meanTokensPerRequest: newMeanTokensPerRequest } = getAggMetrics();

    expect(newP95Latency < p95Latency);
    expect(newMeanTokensPerRequest < meanTokensPerRequest);
  })
});
