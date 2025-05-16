import { test, expect } from "@playwright/test";

const fakeArticles = [
  {
    _id: "1",
    url: "/article/1",
    title: "First Article",
    content: "Summary1",
    summary: "Summary1",
    topics: ["tech"],
    source: "Source A",
    fetchedAt: new Date().toISOString(),
  },
  {
    _id: "2",
    url: "/article/2",
    title: "Second Article",
    content: "Summary2",
    summary: "Summary2",
    topics: ["news"],
    source: "Source B",
    fetchedAt: new Date().toISOString(),
  },
];

test.describe("Favorites Page", () => {
  test("shows not-logged-in message when no token is present", async ({
    page,
  }) => {
    await page.goto("/favorites");
    const notLoggedIn = page.locator(".not-logged-in");
    await expect(notLoggedIn).toBeVisible();
    await expect(notLoggedIn.locator("text=sign in")).toBeVisible();
    await expect(notLoggedIn.locator("a")).toHaveAttribute(
      "href",
      "/auth/login",
    );
  });

  test("shows loading indicator while fetching", async ({ page }) => {
    // Set a fake token before the app code runs
    await page.addInitScript(() => {
      localStorage.setItem("token", "fake-token");
    });

    // Delay the API response so we can catch the loading state
    await page.route("**/api/favorites", async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/favorites");
    await expect(page.locator(".loading-msg")).toHaveText(
      "Loading favorites...",
    );
    await page.waitForResponse("**/api/favorites");
    await expect(page.locator(".loading-msg")).toHaveCount(0);
  });

  test("shows no-favorites message when API returns empty array", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("token", "fake-token");
    });
    await page.route("**/api/favorites", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      }),
    );

    await page.goto("/favorites");
    await expect(page.locator(".no-favorites")).toHaveText(
      "You have not favorited any articles yet.",
    );
  });

  test("renders favorite articles grid when API returns data", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("token", "fake-token");
    });
    await page.route("**/api/favorites", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fakeArticles),
      }),
    );

    await page.goto("/favorites");
    const grid = page.locator(".article-grid");
    await expect(grid).toBeVisible();
    await expect(grid.locator("> *")).toHaveCount(fakeArticles.length);
    // Check that the first article's title is rendered
    await expect(grid.locator(`text=${fakeArticles[0].title}`)).toBeVisible();
  });

  test("back to home link navigates correctly", async ({ page }) => {
    await page.goto("/favorites");
    const backLink = page.locator(".back-home-link");
    await expect(backLink).toHaveAttribute("href", "/");
    await backLink.click();
    await expect(page).toHaveURL("/");
  });
});
