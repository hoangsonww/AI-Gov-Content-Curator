process.env.GOOGLE_AI_API_KEY  = "key1"
process.env.GOOGLE_AI_API_KEY1 = "key2"

jest.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: jest.fn().mockResolvedValue({
        response: { text: () => "Alpha, Beta, gamma, alpha" }
      })
    })
  })),
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT:           0,
    HARM_CATEGORY_HATE_SPEECH:          1,
    HARM_CATEGORY_SEXUALLY_EXPLICIT:    2,
    HARM_CATEGORY_DANGEROUS_CONTENT:    3,
  },
  HarmBlockThreshold: {
    BLOCK_NONE: 0,
  },
  GenerationConfig: {}, // placeholder
}))

const { extractTopics } = require("../services/topicExtractor.service")

describe("extractTopics", () => {
  it("calls AI and returns cleaned, deduped topics", async () => {
    const raw = "Some long text"
    const topics = await extractTopics(raw)
    expect(topics).toEqual(["alpha", "beta", "gamma"])
  })

  it("truncates input over MAX_CONTENT_CHARS", async () => {
    const longText = "x".repeat(5000)
    const topics = await extractTopics(longText)
    expect(topics).toEqual(["alpha", "beta", "gamma"])
  })
})
