// 1. Mock @google/generative-ai so askGemini uses our stubbed model
const sendMessageMock = jest.fn();
const startChatMock = jest.fn().mockReturnValue({ sendMessage: sendMessageMock });
const getGenerativeModelMock = jest.fn().mockReturnValue({ startChat: startChatMock });
const GoogleGenerativeAI = jest.fn().mockImplementation(() => ({
  getGenerativeModel: getGenerativeModelMock,
}));

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI,
  GenerationConfig: {},         // not used in tests
  HarmCategory: { HARASSMENT: 0 },
  HarmBlockThreshold: { BLOCK_NONE: 0 },
}));

// now import after mocks
const { handleChat } = require("../controllers/chat.controller");

describe("chat.controller – handleChat", () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    jest.clearAllMocks();
    // mock req/res/next
    req = { body: {} };
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
    expect(res.json).toHaveBeenCalledWith({ error: "`article` and `userMessage` are required." });

    // missing userMessage only
    req.body.article = { title: "T", content: "C" };
    req.body.userMessage = undefined;
    await handleChat(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "`article` and `userMessage` are required." });
  });

  it("invokes askGemini and returns reply on success", async () => {
    // stub sendMessage to resolve a response
    sendMessageMock.mockResolvedValue({
      response: { text: () => " Hello from Gemini " },
    });

    req.body.article = { title: "Title", content: "Some content" };
    req.body.userMessage = "Hi there";
    req.body.history = [{ role: "user", text: "hey" }];

    await handleChat(req, res, next);

    // GoogleGenerativeAI constructed once per API_KEYS × MODELS; at least one call
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
});
