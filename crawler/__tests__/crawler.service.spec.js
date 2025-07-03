// 1. Mock axios with a factory so axios.get is a jest.fn()
jest.mock("axios", () => ({
  get: jest.fn(),
}))
const axios = require("axios")

// 2. Mock Chromium helper
jest.mock("@sparticuz/chromium", () => ({
  executablePath: jest.fn().mockResolvedValue("/usr/bin/chrome"),
  headless: true,
  args: [],
}))

// 3. Mock puppeteer-core
jest.mock("puppeteer-core", () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: async () => ({
      setUserAgent: jest.fn(),
      goto: jest.fn(),
      content: jest.fn().mockResolvedValue(
        '<html><head><title>DynamicTitle</title></head><body>dynamic body text</body></html>'
      ),
    }),
    close: jest.fn(),
  }),
}))

const {
  fetchStaticArticle,
  fetchDynamicArticle,
} = require("../services/crawler.service")

describe("crawler.service", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("fetchStaticArticle returns parsed object", async () => {
    // Arrange
    axios.get.mockResolvedValue({
      data:
        '<html><head><title>StaticTitle</title></head><body>static body text</body></html>',
    })

    // Act
    const result = await fetchStaticArticle("https://static.example.com")

    // Assert
    expect(axios.get).toHaveBeenCalledWith(
      "https://static.example.com",
      expect.objectContaining({
        headers: expect.any(Object),
        timeout: expect.any(Number),
      })
    )
    expect(result).toMatchObject({
      url: "https://static.example.com",
      source: "https://static.example.com",
    })
    expect(result.title).toBe("StaticTitle")
    expect(result.content).toContain("static body text")
  })

  test("fetchDynamicArticle returns parsed object", async () => {
    // Act
    const result = await fetchDynamicArticle("https://dynamic.example.com")

    // Assert
    expect(result).toMatchObject({
      url: "https://dynamic.example.com",
      source: "https://dynamic.example.com",
    })
    expect(result.title).toBe("DynamicTitle")
    expect(result.content).toContain("dynamic body text")
  })
})
