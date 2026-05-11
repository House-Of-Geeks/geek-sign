import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * On-platform richtext composition (templates + one-off documents) is currently
 * restricted to super admins. Regular tenants only see the PDF upload flow.
 */
export async function canUseRichtext(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!user?.isSuperAdmin;
}
