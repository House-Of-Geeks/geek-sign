import { test, expect } from "@playwright/test";

/**
 * Template composer happy path:
 *  - Chooser routes "Start from scratch" into the blank bootstrapper
 *  - Bootstrapper creates a draft and lands on /compose
 *  - Editing title, content, signers, and variables triggers autosave
 *  - Reload shows the persisted state
 */
test.describe("Template composer (richtext)", () => {
  test("create, edit, autosave, reload", async ({ page }) => {
    const uniqueTitle = `E2E Template ${Date.now()}`;

    await page.goto("/dashboard/templates/new");
    await expect(page.getByRole("heading", { name: /create template/i })).toBeVisible();

    await page.getByRole("link", { name: /open composer/i }).click();

    // Bootstrapper creates the template and forwards into /compose
    await page.waitForURL(/\/dashboard\/templates\/[^/]+\/compose/, {
      timeout: 30_000,
    });

    // Title input (the only big text input at the top)
    const titleInput = page.getByPlaceholder("Untitled template");
    await expect(titleInput).toBeVisible();
    await titleInput.fill(uniqueTitle);

    // Tiptap editor — find the contenteditable
    const editor = page.locator(".ProseMirror");
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type("This is an end-to-end test agreement.");

    // Add a second signer to exercise the role manager
    const addSignerInput = page.getByPlaceholder(/add signer/i);
    await addSignerInput.fill("Counterparty");
    await addSignerInput.press("Enter");

    // Add a variable
    const addVarInput = page.getByPlaceholder("Client name");
    await addVarInput.fill("Project name");
    await addVarInput.press("Enter");

    // Drop a signature field for the first signer
    const fieldButtons = page.getByRole("button", { name: /^signature$/i });
    await fieldButtons.first().click();

    // Autosave indicator should land on "Saved"
    await expect(page.getByText("Saved", { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    const composeUrl = page.url();

    // Reload — content must persist
    await page.reload();

    await expect(page.getByPlaceholder("Untitled template")).toHaveValue(uniqueTitle);
    await expect(page.locator(".ProseMirror")).toContainText(
      "This is an end-to-end test agreement."
    );
    // The variable chip is rendered with {{}} markers in the editor
    await expect(page.locator(".ProseMirror")).toContainText("Project name");
    expect(page.url()).toBe(composeUrl);
  });
});
