/**
 * Script: merge-user-to-team.ts
 *
 * Adds jos@profitgeeks.com.au as a member of andy@theandylife.com's team
 * and associates all of jos's documents with that team.
 *
 * Run: npx ts-node --project tsconfig.json -r dotenv/config scripts/merge-user-to-team.ts
 */

import { db } from "../src/lib/db/index.js";
import { users, teams, teamMembers, documents } from "../src/lib/db/schema.js";
import { eq, and } from "drizzle-orm";

const JOS_EMAIL = "jos@profitgeeks.com.au";
const ANDY_EMAIL = "andy@theandylife.com";

async function mergeUserToTeam() {
  console.log("=== Merge User to Team ===\n");

  // 1. Fetch both users
  const [josUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, JOS_EMAIL));

  const [andyUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, ANDY_EMAIL));

  if (!josUser) {
    console.error(`ERROR: User not found: ${JOS_EMAIL}`);
    process.exit(1);
  }
  if (!andyUser) {
    console.error(`ERROR: User not found: ${ANDY_EMAIL}`);
    process.exit(1);
  }

  console.log(`Found jos: ${josUser.id} (${josUser.name})`);
  console.log(`Found andy: ${andyUser.id} (${andyUser.name})`);

  // 2. Find or create andy's team
  let [andyTeam] = await db
    .select()
    .from(teams)
    .where(eq(teams.ownerId, andyUser.id));

  if (!andyTeam) {
    console.log("\nAndy has no team — creating one...");
    const [newTeam] = await db
      .insert(teams)
      .values({
        name: `${andyUser.name || "Andy"}'s Team`,
        ownerId: andyUser.id,
      })
      .returning();
    andyTeam = newTeam;

    // Add andy as owner in teamMembers
    await db.insert(teamMembers).values({
      teamId: andyTeam.id,
      userId: andyUser.id,
      role: "owner",
    });
    console.log(`Created team: "${andyTeam.name}" (${andyTeam.id})`);
  } else {
    console.log(`\nFound andy's team: "${andyTeam.name}" (${andyTeam.id})`);
  }

  // 3. Add jos to andy's team (skip if already a member)
  const [existingMembership] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, andyTeam.id),
        eq(teamMembers.userId, josUser.id)
      )
    );

  if (existingMembership) {
    console.log(`\njos is already a member of andy's team (role: ${existingMembership.role}) — skipping.`);
  } else {
    await db.insert(teamMembers).values({
      teamId: andyTeam.id,
      userId: josUser.id,
      role: "member",
    });
    console.log(`\nAdded jos to andy's team as 'member'.`);
  }

  // 4. Associate jos's documents with andy's team
  const josDocs = await db
    .select({ id: documents.id, title: documents.title, teamId: documents.teamId })
    .from(documents)
    .where(eq(documents.userId, josUser.id));

  console.log(`\njos has ${josDocs.length} document(s).`);

  const docsToUpdate = josDocs.filter((d) => d.teamId !== andyTeam.id);

  if (docsToUpdate.length === 0) {
    console.log("All of jos's documents are already in andy's team.");
  } else {
    for (const doc of docsToUpdate) {
      await db
        .update(documents)
        .set({ teamId: andyTeam.id })
        .where(eq(documents.id, doc.id));
      console.log(`  Updated: "${doc.title}" (${doc.id})`);
    }
    console.log(`\nUpdated ${docsToUpdate.length} document(s) to andy's team.`);
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

mergeUserToTeam().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
