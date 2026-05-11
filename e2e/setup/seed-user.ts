import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

export const E2E_USER = {
  email: "e2e@geeksign.test",
  password: "e2etest1234!",
  name: "E2E Test User",
} as const;

/**
 * Ensure the E2E test user exists in the database. Idempotent — safe to
 * call on every run. Returns the user's id.
 */
export async function ensureE2EUser(): Promise<string> {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL[_UNPOOLED] is not set — load .env.local first");
  }
  const sql = neon(url);

  const passwordHash = await bcrypt.hash(E2E_USER.password, 10);

  // Upsert by email; preserve existing id and password if already present.
  const rows = (await sql`
    INSERT INTO users (email, name, password, plan, is_super_admin, jurisdiction)
    VALUES (${E2E_USER.email}, ${E2E_USER.name}, ${passwordHash}, 'team', true, 'AU')
    ON CONFLICT (email) DO UPDATE
      SET password = EXCLUDED.password,
          name = EXCLUDED.name
    RETURNING id
  `) as Array<{ id: string }>;

  if (rows.length === 0) {
    throw new Error("Failed to seed E2E user");
  }
  return rows[0].id;
}
