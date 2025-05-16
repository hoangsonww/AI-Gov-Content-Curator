import { test, expect } from "@playwright/test";

test.describe("Register Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the register page
    await page.goto("/auth/register");
  });

  test("renders registration form correctly", async ({ page }) => {
    await expect(page.locator("h1.register-title")).toHaveText("Register 📝");
    await expect(page.locator('input[type="text"]')).toBeVisible(); // Name
    await expect(page.locator('input[type="email"]')).toBeVisible(); // Email
    const passwordInputs = page.locator(".password-input-container input");
    await expect(passwordInputs).toHaveCount(2); // Password & Confirm
    await expect(page.locator('button[type="submit"]')).toHaveText("Register");
    await expect(page.locator(".form-links")).toBeVisible();
  });

  test("toggles password visibility for both password fields", async ({
    page,
  }) => {
    const pwdInputs = page.locator(".password-input-container input");
    const toggleBtns = page.locator(".password-toggle-btn");

    // Initially both should be type="password"
    await expect(pwdInputs.nth(0)).toHaveAttribute("type", "password");
    await expect(pwdInputs.nth(1)).toHaveAttribute("type", "password");

    // Click the first toggle button
    await toggleBtns.nth(0).click();
    await expect(pwdInputs.nth(0)).toHaveAttribute("type", "text");
    await expect(pwdInputs.nth(1)).toHaveAttribute("type", "text");

    // Click again to hide
    await toggleBtns.nth(0).click();
    await expect(pwdInputs.nth(0)).toHaveAttribute("type", "password");
    await expect(pwdInputs.nth(1)).toHaveAttribute("type", "password");
  });

  test("shows client-side error when passwords do not match", async ({
    page,
  }) => {
    await page.fill('input[type="text"]', "Alice");
    await page.fill('input[type="email"]', "alice@example.com");
    await page.fill('input[name="password"]', "password123");
    await page.fill('input[name="confirmPassword"]', "passwordABC");
    await page.click('button[type="submit"]');
    await expect(page.locator(".error-msg")).toHaveText(
      "Passwords do not match",
    );
  });

  test("shows server error on failed registration attempt", async ({
    page,
  }) => {
    // Stub the registration API to return a 400
    await page.route("**/api/users", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ message: "Email already in use" }),
      }),
    );

    await page.fill('input[type="text"]', "Bob");
    await page.fill('input[type="email"]', "bob@example.com");
    await page.fill('input[name="password"]', "securePass1");
    await page.fill('input[name="confirmPassword"]', "securePass1");
    await page.click('button[type="submit"]');

    // Should display error message from server
    await expect(page.locator(".error-msg")).toHaveText("Email already in use");
    // And show toast fallback
    await expect(page.locator(".Toastify__toast-body")).toHaveText(
      "Could not register user. Please try again.",
    );
  });

  test("navigates to /api/users/ on successful registration", async ({
    page,
  }) => {
    // Stub a successful registration response
    await page.route("**/api/users", (route) =>
      route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: "new-user-id" }),
      }),
    );

    await page.fill('input[type="text"]', "Carol");
    await page.fill('input[type="email"]', "carol@example.com");
    await page.fill('input[name="password"]', "MySecret1");
    await page.fill('input[name="confirmPassword"]', "MySecret1");
    await page.click('button[type="submit"]');

    // Success toast
    await expect(page.locator(".Toastify__toast-body")).toHaveText(
      "Registration successful! 🔓",
    );

    // Should redirect to /api/users/
    await expect(page).toHaveURL("/api/users/");
  });
});
