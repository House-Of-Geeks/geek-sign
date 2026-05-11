import { SQL, and, eq, inArray, or } from "drizzle-orm";
import { db } from "./index";
import { documents, teamMembers } from "./schema";

export async function getUserTeamIds(userId: string): Promise<string[]> {
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  return memberships.map((m) => m.teamId);
}

export function documentAccessClause(
  documentId: string,
  userId: string,
  teamIds: string[]
): SQL {
  return and(
    eq(documents.id, documentId),
    teamIds.length > 0
      ? or(eq(documents.userId, userId), inArray(documents.teamId, teamIds))
      : eq(documents.userId, userId)
  )!;
}
