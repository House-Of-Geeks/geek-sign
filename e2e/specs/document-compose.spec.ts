import { test, expect } from "@playwright/test";

/**
 * One-off document composer:
 *  - /documents/new chooser
 *  - "Compose on platform" creates a blank richtext draft
 *  - Add a signer with email, drop a signature field
 *  - "Prepare to send" finalizes (creates recipients + fields) and
 *    redirects to the document detail page
 */
test.describe("Document composer (richtext one-off)", () => {
  test("compose → finalize → detail page", async ({ page }) => {
    const uniqueTitle = `E2E Document ${Date.now()}`;
    const signerEmail = `signer-${Date.now()}@geeksign.test`;

    await page.goto("/dashboard/documents/new");
    await expect(page.getByRole("heading", { name: /new document/i })).toBeVisible();

    await page.getByRole("link", { name: /open composer/i }).click();
    await page.waitForURL(/\/dashboard\/documents\/[^/]+\/compose/, {
      timeout: 30_000,
    });

    const docId = page.url().split("/documents/")[1].split("/")[0];

    // Title
    const titleInput = page.getByPlaceholder("Untitled document");
    await titleInput.fill(uniqueTitle);

    // Body
    const editor = page.locator(".ProseMirror");
    await editor.click();
    await page.keyboard.type("Signed by the parties below.");

    // Fill in the default signer's email
    await page.getByPlaceholder("email@example.com").first().fill(signerEmail);

    // Drop a signature field
    await page.getByRole("button", { name: /^signature$/i }).first().click();

    // Wait for autosave
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({
      timeout: 15_000,
    });

    // Click "Prepare to send"
    await page.getByRole("button", { name: /prepare to send/i }).click();

    // Should redirect to the detail page
    await page.waitForURL(`**/dashboard/documents/${docId}`, {
      timeout: 30_000,
    });

    await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible({
      timeout: 10_000,
    });

    // The composed content appears in the preview block
    await expect(page.getByText("Signed by the parties below.")).toBeVisible();
    // The recipient should appear somewhere on the page
    await expect(page.getByText(signerEmail)).toBeVisible();
  });

  test("prepare-to-send is disabled until every signer has a valid email", async ({ page }) => {
    await page.goto("/dashboard/documents/new");
    await page.getByRole("link", { name: /open composer/i }).click();
    await page.waitForURL(/\/dashboard\/documents\/[^/]+\/compose/);

    const prepareBtn = page.getByRole("button", { name: /prepare to send/i });
    await expect(prepareBtn).toBeDisabled();

    await page.getByPlaceholder("email@example.com").first().fill("not-an-email");
    await expect(prepareBtn).toBeDisabled();

    await page.getByPlaceholder("email@example.com").first().fill("valid@example.com");
    await expect(prepareBtn).toBeEnabled();
  });
});
