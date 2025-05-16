import { test, expect } from "@playwright/test";

test.describe("HomePage", () => {
  test("renders static layout and latest/all articles sections", async ({
    page,
  }) => {
    // Start Next in dev mode via playwright.config.ts webServer
    await page.goto("/");

    // <Head> title
    await expect(page).toHaveTitle(
      /Article Curator - AI-Powered News Article Content Curator/,
    );

    // Search box
    const searchInput = page.locator(".search-input");
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveValue("");

    // Page title + subtitle
    await expect(page.locator("h1.page-title")).toHaveText(
      "Latest Articles ✨",
    );
    await expect(page.locator(".subtitle")).toHaveText(
      /Freshly gathered, thoughtfully summarized\./,
    );

    // LatestArticles & AllArticles containers
    await expect(page.locator(".latest-articles-container")).toBeVisible();
    await expect(page.locator(".all-articles-container")).toBeVisible();
  });

  test("typing in search updates query params (shallow routing)", async ({
    page,
  }) => {
    await page.goto("/");

    const searchInput = page.locator(".search-input");
    await searchInput.fill("playwright");
    // shallow push → URL should include ?q=playwright&topic=
    await expect(page).toHaveURL(/\?q=playwright&topic=$/);
  });

  test("when query params present, ArticleSearch is shown instead of latest/all", async ({
    page,
  }) => {
    // Navigate with both q and topic set
    await page.goto("/?q=test-query&topic=technology");

    // Expect the ArticleSearch component (assuming it has a unique class or role)
    // Adjust selector if needed!
    const articleSearch = page.locator("article-search, .article-search");
    await expect(articleSearch).toBeVisible();

    // The "LatestArticles" and "AllArticles" sections should be hidden
    await expect(page.locator(".latest-articles-container")).toHaveCount(0);
    await expect(page.locator(".all-articles-container")).toHaveCount(0);

    // If your ArticleSearch renders a “Clear” button/link, test it clears
    const clearButton = page.locator("text=Clear");
    if (await clearButton.count()) {
      await clearButton.click();
      await expect(page).toHaveURL("/");
      // Back to showing LatestArticles
      await expect(page.locator(".latest-articles-container")).toBeVisible();
    }
  });
});
