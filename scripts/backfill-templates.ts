import { db } from "../src/lib/db/index.js";
import { templates, teamMembers } from "../src/lib/db/schema.js";
import { eq } from "drizzle-orm";

async function backfill() {
  const memberships = await db.select().from(teamMembers);
  console.log(`Found ${memberships.length} team membership(s)\n`);

  let total = 0;
  for (const m of memberships) {
    const updated = await db
      .update(templates)
      .set({ teamId: m.teamId })
      .where(eq(templates.userId, m.userId))
      .returning({ id: templates.id, name: templates.name });

    for (const t of updated) {
      console.log(`  Updated: "${t.name}" (${t.id})`);
      total++;
    }
  }

  console.log(`\nDone. ${total} template(s) updated.`);
  process.exit(0);
}

backfill().catch((err) => { console.error(err); process.exit(1); });
