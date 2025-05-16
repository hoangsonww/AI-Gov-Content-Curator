import { test, expect } from "@playwright/test";

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to your login route
    await page.goto("/auth/login");
  });

  test("renders login form correctly", async ({ page }) => {
    await expect(page.locator("h1.login-title")).toHaveText("Login 🔒");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toHaveText("Login");
    await expect(page.locator(".form-links")).toBeVisible();
  });

  test("toggles password visibility", async ({ page }) => {
    const pwdInput = page.locator(".password-input-container input");
    const toggleBtn = page.locator(".password-toggle-btn");

    // initially masked
    await expect(pwdInput).toHaveAttribute("type", "password");

    // click to reveal
    await toggleBtn.click();
    await expect(pwdInput).toHaveAttribute("type", "text");

    // click again to mask
    await toggleBtn.click();
    await expect(pwdInput).toHaveAttribute("type", "password");
  });

  test("shows error on failed login attempt", async ({ page }) => {
    // Intercept the login API call and return a 401
    await page.route("**/api/login", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Invalid credentials" }),
      }),
    );

    await page.fill('input[type="email"]', "user@example.com");
    await page.fill('input[type="password"]', "wrongpass");
    await page.click('button[type="submit"]');

    // The React state `error` should show up in .error-msg
    await expect(page.locator(".error-msg")).toHaveText("Invalid credentials");

    // And the toast fallback
    await expect(page.locator(".Toastify__toast-body")).toHaveText(
      "Could not login user. Please try again.",
    );
  });

  test("navigates to home on successful login", async ({ page }) => {
    // Stub a successful login response
    await page.route("**/api/login", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ token: "fake-jwt-token" }),
      }),
    );

    await page.fill('input[type="email"]', "user@example.com");
    await page.fill('input[type="password"]', "correctpass");
    await page.click('button[type="submit"]');

    // Successful toast
    await expect(page.locator(".Toastify__toast-body")).toHaveText(
      "Login successful! 🔐",
    );

    // Should redirect to home
    await expect(page).toHaveURL("/");
  });
});
