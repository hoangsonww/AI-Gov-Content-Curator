const path = "../services/apiFetcher.service"
const axios = { get: jest.fn() }
jest.mock("axios", () => axios)

const makeArticle = (url, t = "t") => ({
  url,
  title: t,
  content: null,
  description: "desc",
  source: { name: "SRC" },
})

/* utility to (re-)load the module with fresh env + mocks */
const loadService = () => {
  jest.resetModules()
  delete process.env.NEWS_API_KEY
  delete process.env.NEWS_API_KEY1
  process.env.NEWS_API_KEY  = "k0"
  process.env.NEWS_API_KEY1 = "k1"
  return require(path)
}

describe("fetchArticlesFromNewsAPI", () => {
  afterEach(() => jest.clearAllMocks())

  test("happy path – three pages, filters static/anchor urls", async () => {
    const art1 = makeArticle("https://nytimes.com/good")
    const artBadStatic = makeArticle("https://x.com/file.css")
    const artBadAnchor = makeArticle("https://x.com/p#frag")

    const art2 = makeArticle("https://wp.com/ok2")
    const art3 = makeArticle("https://wp.com/ok3")

    axios.get
      .mockResolvedValueOnce({
        data: { totalResults: 250, articles: [art1, artBadStatic, artBadAnchor] },
      })
      .mockResolvedValueOnce({ data: { articles: [art2] } })
      .mockResolvedValueOnce({ data: { articles: [art3] } })

    const { fetchArticlesFromNewsAPI } = loadService()
    const out = await fetchArticlesFromNewsAPI()

    expect(out).toEqual([
      { url: art1.url, title: art1.title, content: art1.description, source: "SRC" },
      { url: art2.url, title: art2.title, content: art2.description, source: "SRC" },
      { url: art3.url, title: art3.title, content: art3.description, source: "SRC" },
    ])
    expect(axios.get).toHaveBeenCalledTimes(3)
  })

  test("key rotation on 401 then success", async () => {
    const err401 = Object.assign(new Error("unauth"), {
      response: { status: 401 },
    })
    axios.get
      .mockRejectedValueOnce(err401)                      // first key fails
      .mockResolvedValueOnce({ data: { totalResults: 0, articles: [] } })

    const { fetchArticlesFromNewsAPI } = loadService()
    const out = await fetchArticlesFromNewsAPI()

    expect(out).toEqual([])
    expect(axios.get).toHaveBeenCalledTimes(2)            // rotated to second key
  })
})
