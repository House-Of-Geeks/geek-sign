import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recipients, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { signature, initials } = await request.json();

    // Verify the token is valid
    const [recipient] = await db
      .select({ email: recipients.email })
      .from(recipients)
      .where(eq(recipients.signingToken, params.token))
      .limit(1);

    if (!recipient) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    // Find the matching registered user by email
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, recipient.email))
      .limit(1);

    if (!user) {
      // Not a registered user — nothing to save, but not an error
      return NextResponse.json({ saved: false });
    }

    const updates: { savedSignature?: string | null; savedInitials?: string | null } = {};
    if (signature !== undefined) updates.savedSignature = signature || null;
    if (initials !== undefined) updates.savedInitials = initials || null;

    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, user.id));
    }

    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Save signature error:", error);
    return NextResponse.json({ error: "Failed to save signature" }, { status: 500 });
  }
}
