import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recipients, documentFields } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

interface FieldUpdate {
  id: string;
  value: string | null;
}

// PATCH /api/sign/[token]/progress — save partial field values without completing
export async function PATCH(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { fields } = await request.json() as { fields: FieldUpdate[] };

    const [recipient] = await db
      .select()
      .from(recipients)
      .where(eq(recipients.signingToken, params.token));

    if (!recipient) {
      return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });
    }

    if (recipient.status === "signed") {
      return NextResponse.json({ error: "Document already signed" }, { status: 400 });
    }

    // Save only fields that belong to this recipient
    for (const field of fields) {
      if (!field.id || field.value === undefined) continue;
      await db
        .update(documentFields)
        .set({ value: field.value })
        .where(
          and(
            eq(documentFields.id, field.id),
            eq(documentFields.recipientId, recipient.id)
          )
        );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error saving signing progress:", error);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
