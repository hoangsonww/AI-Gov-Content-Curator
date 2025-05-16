import { test, expect } from "@playwright/test";

test.describe("Article Details Page", () => {
  test("displays article details when article exists", async ({ page }) => {
    const validId = "682589645ae5e890ad9df49f"; // mockup

    // Navigate to the dynamic article page
    await page.goto(`/${validId}`);

    // 1) Dynamic <Head> title uses first 5 words of article title
    await expect(page).toHaveTitle(/^Article Curator - /);

    // 2) ArticleDetail component is rendered
    //    (add className="article-detail" around your ArticleDetail wrapper if needed)
    const detail = page.locator(".article-detail");
    await expect(detail).toBeVisible();

    // 3) Back to Home link
    const backLink = page.locator(".back-home-link");
    await expect(backLink).toHaveText(/Back to Home/i);
    await expect(backLink).toHaveAttribute("href", "/");

    // Click and verify navigation
    await backLink.click();
    await expect(page).toHaveURL("/");
  });

  test("shows error message when article not found", async ({ page }) => {
    // Use a guaranteed-nonexistent ID
    await page.goto("/___not_found___");

    const error = page.locator(".error-message");
    await expect(error).toHaveText("Article not found");
  });
});
