// Mock axios to expose `get` as a jest.fn()
jest.mock("axios", () => ({
  get: jest.fn()
}))
const axios = require("axios")

// Mock @sparticuz/chromium
jest.mock("@sparticuz/chromium", () => ({
  executablePath: jest.fn().mockResolvedValue("/usr/bin/chrome"),
  headless: true,
  args: []
}))

// Mock puppeteer-core
jest.mock("puppeteer-core", () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: async () => ({
      setUserAgent: jest.fn(),
      goto: jest.fn(),
      content: jest.fn().mockResolvedValue(
        '<html><head><title>Dyn</title></head><body>dyn body</body></html>'
      )
    }),
    close: jest.fn()
  })
}))

const {
  fetchStaticArticle,
  fetchDynamicArticle
} = require("../services/crawler.service")

describe("crawler.service", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test("fetchStaticArticle returns parsed object", async () => {
    axios.get.mockResolvedValue({
      data:
        '<html><head><title>Stat</title></head><body>static body</body></html>'
    })

    const result = await fetchStaticArticle("https://static.test")

    expect(axios.get).toHaveBeenCalledWith("https://static.test", expect.any(Object))
    expect(result).toMatchObject({
      url: "https://static.test",
      source: "https://static.test"
    })
    expect(result.title).toBe("Stat")
    expect(result.content).toContain("static body")
  })

  test("fetchDynamicArticle returns parsed object", async () => {
    const result = await fetchDynamicArticle("https://dynamic.test")

    expect(result).toMatchObject({
      url: "https://dynamic.test",
      source: "https://dynamic.test"
    })
    expect(result.title).toBe("Dyn")
    expect(result.content).toContain("dyn body")
  })
})
