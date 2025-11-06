import { test, expect } from "@playwright/test";

test.describe("Dashboard Page", () => {
  test("renders dashboard layout and charts", async ({ page }) => {
    // Navigate to dashboard
    await page.goto("/dashboard");

    // Check page title
    await expect(page).toHaveTitle(/Analytics Dashboard - SynthoraAI/);

    // Check main heading
    const heading = page.locator("h1").filter({ hasText: "Analytics Dashboard" });
    await expect(heading).toBeVisible();

    // Check filter section exists
    const filterSection = page.locator("text=Filters");
    await expect(filterSection).toBeVisible();

    // Check date inputs exist
    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').nth(1);
    await expect(startDateInput).toBeVisible();
    await expect(endDateInput).toBeVisible();

    // Check quick filter buttons
    const last7DaysBtn = page.locator('button:has-text("Last 7 Days")');
    const last30DaysBtn = page.locator('button:has-text("Last 30 Days")');
    await expect(last7DaysBtn).toBeVisible();
    await expect(last30DaysBtn).toBeVisible();
  });

  test("displays chart sections when data is available", async ({ page }) => {
    await page.goto("/dashboard");

    // Wait for potential loading to complete
    await page.waitForTimeout(2000);

    // Check for chart section headings
    const sourceDistribution = page.locator("h2:has-text('Source Distribution')");
    const topicTrends = page.locator("h2:has-text('Topic Trends Over Time')");
    const articlesSource = page.locator("h2:has-text('Articles by Source')");
    const topRated = page.locator("h2:has-text('Top Rated Articles')");

    await expect(sourceDistribution).toBeVisible();
    await expect(topicTrends).toBeVisible();
    await expect(articlesSource).toBeVisible();
    await expect(topRated).toBeVisible();
  });

  test("quick filter buttons update date range", async ({ page }) => {
    await page.goto("/dashboard");

    const startDateInput = page.locator('input[type="date"]').first();
    const endDateInput = page.locator('input[type="date"]').nth(1);

    // Click Last 7 Days button
    const last7DaysBtn = page.locator('button:has-text("Last 7 Days")');
    await last7DaysBtn.click();

    // Check that date inputs are now filled
    await expect(startDateInput).not.toHaveValue("");
    await expect(endDateInput).not.toHaveValue("");

    // Click Last 30 Days button
    const last30DaysBtn = page.locator('button:has-text("Last 30 Days")');
    await last30DaysBtn.click();

    // Dates should still be filled (but different values)
    await expect(startDateInput).not.toHaveValue("");
    await expect(endDateInput).not.toHaveValue("");
  });

  test("clear button resets filters", async ({ page }) => {
    await page.goto("/dashboard");

    const startDateInput = page.locator('input[type="date"]').first();
    const clearBtn = page.locator('button:has-text("Clear")');

    // Set a filter first
    const last7DaysBtn = page.locator('button:has-text("Last 7 Days")');
    await last7DaysBtn.click();

    // Verify date is set
    const initialValue = await startDateInput.inputValue();
    expect(initialValue).not.toBe("");

    // Click clear
    await clearBtn.click();

    // Check that dates are cleared
    await expect(startDateInput).toHaveValue("");
  });

  test("AI insights section is visible", async ({ page }) => {
    await page.goto("/dashboard");

    // Wait for potential API calls
    await page.waitForTimeout(2000);

    // Check for AI insights heading
    const aiInsights = page.locator("h2:has-text('AI-Generated Insights')");
    await expect(aiInsights).toBeVisible();
  });

  test("dashboard is accessible from navigation", async ({ page }) => {
    // Start from home page
    await page.goto("/home");

    // Click dashboard link in navbar
    const dashboardLink = page.locator('a[title="Dashboard"], a:has-text("Dashboard")').first();
    await dashboardLink.click();

    // Should navigate to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify dashboard content loaded
    const heading = page.locator("h1:has-text('Analytics Dashboard')");
    await expect(heading).toBeVisible();
  });
});
