import { db } from "../src/lib/db/index.js";
import { documents, teamMembers } from "../src/lib/db/schema.js";
import { eq, isNull } from "drizzle-orm";

async function backfill() {
  const memberships = await db.select().from(teamMembers);
  console.log(`Found ${memberships.length} team membership(s)\n`);

  let total = 0;
  for (const m of memberships) {
    const updated = await db
      .update(documents)
      .set({ teamId: m.teamId })
      .where(eq(documents.userId, m.userId))
      .returning({ id: documents.id, title: documents.title });

    for (const doc of updated) {
      console.log(`  Updated: "${doc.title}" (${doc.id})`);
      total++;
    }
  }

  console.log(`\nDone. ${total} document(s) updated.`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
