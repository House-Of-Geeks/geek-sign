import { chromium, type FullConfig } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { ensureE2EUser, E2E_USER } from "./seed-user";

const STORAGE_STATE = path.resolve(__dirname, "../.auth/user.json");

export default async function globalSetup(config: FullConfig) {
  // Load .env.local so DATABASE_URL is available to the seed step
  loadEnv({ path: path.resolve(__dirname, "../../.env.local") });

  await ensureE2EUser();

  fs.mkdirSync(path.dirname(STORAGE_STATE), { recursive: true });

  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:3000";

  const browser = await chromium.launch();
  const context = await browser.newContext();
  try {
    // Programmatic credentials sign-in: fetch a CSRF token, then POST to
    // NextAuth's callback. Avoids waiting for the login form to hydrate
    // (slow on the dev-server first compile).
    // Per-request 2-minute timeout — first-hit compile of the NextAuth route
    // can be slow on this filesystem.
    const REQ_OPTS = { timeout: 120_000 } as const;
    const csrfRes = await context.request.get(
      `${baseURL}/api/auth/csrf`,
      REQ_OPTS
    );
    const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

    const callbackRes = await context.request.post(
      `${baseURL}/api/auth/callback/credentials`,
      {
        ...REQ_OPTS,
        form: {
          csrfToken,
          email: E2E_USER.email,
          password: E2E_USER.password,
          callbackUrl: `${baseURL}/dashboard`,
          redirect: "false",
          json: "true",
        },
      }
    );

    if (!callbackRes.ok()) {
      throw new Error(
        `Credentials sign-in failed: ${callbackRes.status()} ${await callbackRes.text()}`
      );
    }

    // Verify the session is real by hitting /api/auth/session
    const sessionRes = await context.request.get(
      `${baseURL}/api/auth/session`,
      REQ_OPTS
    );
    const session = (await sessionRes.json()) as { user?: { email?: string } };
    if (!session?.user?.email) {
      throw new Error(
        `Session not established after sign-in: ${JSON.stringify(session)}`
      );
    }

    await context.storageState({ path: STORAGE_STATE });
  } finally {
    await browser.close();
  }
}
