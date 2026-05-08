import { test, expect } from "@playwright/test";

/**
 * Passkey UI smoke tests.
 *
 * Full WebAuthn ceremonies require a Chrome DevTools Protocol Virtual
 * Authenticator. These tests cover the deterministic UI surface — the
 * end-to-end ceremony is exercised via manual QA (or a CDP harness in CI;
 * see the implementation plan).
 */
test.describe("Passkey UI", () => {
  test("login page exposes the passkey button when WebAuthn is available", async ({
    page,
  }) => {
    await page.goto("/auth/login");
    const btn = page.getByRole("button", { name: /sign in with a passkey/i });
    await expect(btn).toBeVisible();
  });

  test("register page exposes the passkey signup button", async ({ page }) => {
    await page.goto("/auth/register");
    const btn = page.getByRole("button", {
      name: /sign up with a passkey/i,
    });
    await expect(btn).toBeVisible();
  });

  test("passkey login button hides when WebAuthn is unavailable", async ({
    page,
  }) => {
    // Strip WebAuthn before the page boots.
    await page.addInitScript(() => {
      // @ts-ignore
      delete (window as any).PublicKeyCredential;
    });
    await page.goto("/auth/login");
    const btn = page.getByRole("button", { name: /sign in with a passkey/i });
    await expect(btn).toHaveCount(0);
  });

  test("passkey login surfaces a toast when verify fails", async ({ page }) => {
    await page.route("**/auth/passkey/authenticate/begin", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          challenge: "Y2hhbGxlbmdl",
          timeout: 60000,
          rpId: "localhost",
          allowCredentials: [],
          userVerification: "preferred",
        }),
      }),
    );

    await page.goto("/auth/login");

    // Force the WebAuthn API to throw a non-NotAllowedError so the catch
    // branch surfaces an error toast (NotAllowedError is silenced).
    await page.evaluate(() => {
      (navigator as any).credentials = {
        get: async () => {
          const e: any = new Error("forced failure");
          e.name = "InvalidStateError";
          throw e;
        },
      };
    });

    await page.getByRole("button", { name: /sign in with a passkey/i }).click();

    await expect(
      page.locator(".Toastify__toast-body", {
        hasText: /could not sign in with passkey/i,
      }),
    ).toBeVisible();
  });
});
