import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { getUserTeamIds } from "@/lib/db/team-access";
import {
  ASSISTANT_KEY_MISSING,
  ASSISTANT_USER_MISSING,
  assistantAuthStatus,
  readAssistantKey,
  readAssistantUserRef,
} from "@/lib/assistant";
import type { ServiceResult } from "@/lib/services/result";

/**
 * Authenticate an assistant request. The bearer token is the only credential:
 * session cookies are never read, and a missing ASSISTANT_API_KEY rejects every
 * call. The assistant acts as one configured GeekSign account, with the same
 * reach that account has in the dashboard (its documents and its teams').
 */

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type AssistantContext = {
  user: {
    id: string;
    email: string;
    name: string | null;
    sendAsName: string | null;
    plan: string;
    isSuperAdmin: boolean;
  };
  teamIds: string[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requireAssistant(request: Request): Promise<AssistantContext> {
  const status = assistantAuthStatus(
    request.headers.get("authorization"),
    readAssistantKey(process.env.ASSISTANT_API_KEY),
  );
  if (status === "unconfigured") throw new HttpError(503, ASSISTANT_KEY_MISSING);
  if (status === "unauthorized") throw new HttpError(401, "Not authorised.");

  const ref = readAssistantUserRef({
    ASSISTANT_USER_ID: process.env.ASSISTANT_USER_ID,
    ASSISTANT_USER_EMAIL: process.env.ASSISTANT_USER_EMAIL,
  });
  if (!ref) throw new HttpError(503, ASSISTANT_USER_MISSING);

  const notFound = new HttpError(503, "The assistant's GeekSign account was not found.");
  if ("id" in ref && !UUID.test(ref.id)) throw notFound;

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      sendAsName: users.sendAsName,
      plan: users.plan,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where("id" in ref ? eq(users.id, ref.id) : sql`lower(${users.email}) = ${ref.email}`)
    .limit(1);
  if (!user) throw notFound;

  return { user, teamIds: await getUserTeamIds(user.id) };
}

/** Ids are UUIDs; anything else cannot exist, so answer 404 instead of letting the database reject it. */
export function requireUuid(id: string, notFound: string): string {
  if (!UUID.test(id)) throw new HttpError(404, notFound);
  return id;
}

/** Parse a JSON request body. With `allowEmpty`, a blank body reads as `{}`. */
export async function readJsonBody(request: Request, options: { allowEmpty?: boolean } = {}): Promise<unknown> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    throw new HttpError(400, "Send a JSON body.");
  }
  if (!text.trim()) {
    if (options.allowEmpty) return {};
    throw new HttpError(400, "Send a JSON body.");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "That wasn't valid JSON.");
  }
}

export function assistantErrorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    const issue = error.issues[0];
    const where = issue?.path.length ? `${issue.path.join(".")}: ` : "";
    return NextResponse.json({ error: issue ? `${where}${issue.message}` : "That request wasn't valid." }, { status: 400 });
  }
  console.error("assistant api error", error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}

/** Turn a failed service result into the JSON error the session routes return. */
export function serviceErrorResponse(result: Extract<ServiceResult<unknown>, { ok: false }>): NextResponse {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
