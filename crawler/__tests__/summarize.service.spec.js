const axios = { get: jest.fn() }
jest.mock("axios", () => axios)

jest.mock("@sparticuz/chromium", () => ({
  executablePath: jest.fn().mockResolvedValue("/bin/chrome"),
  headless: true,
  args: []
}))

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

const { fetchStaticArticle, fetchDynamicArticle } = require("../services/crawler.service")

describe("crawler service minimal", () => {
  beforeEach(() => {
    axios.get.mockReset()
  })

  test("fetchStaticArticle returns parsed object", async () => {
    axios.get.mockResolvedValue({
      data:
        '<html><head><title>Stat</title></head><body>static body</body></html>'
    })

    const out = await fetchStaticArticle("https://x.com")
    expect(out).toMatchObject({
      url: "https://x.com",
      source: "https://x.com"
    })
    expect(typeof out.title).toBe("string")
    expect(out.content.includes("static body")).toBe(true)
  })

  test("fetchDynamicArticle returns parsed object", async () => {
    const out = await fetchDynamicArticle("https://y.com")
    expect(out).toMatchObject({
      url: "https://y.com",
      source: "https://y.com"
    })
    expect(typeof out.title).toBe("string")
    expect(out.content.includes("dyn body")).toBe(true)
  })
})
