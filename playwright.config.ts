import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e/specs",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false, // tests touch a shared dev DB
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",

  globalSetup: path.resolve(__dirname, "./e2e/setup/global-setup.ts"),

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    storageState: "./e2e/.auth/user.json",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // Reuse the dev server if it's already running, otherwise start it.
  // The Next.js dev script can't be invoked directly on this volume because
  // of the shebang permission issue, so we shell out to node + the bin file.
  webServer: {
    command: "node ./node_modules/next/dist/bin/next dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
