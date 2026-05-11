import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, recipients, documentFields } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { documentAccessClause, getUserTeamIds } from "@/lib/db/team-access";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; recipientId: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify document access (owner or team member)
    const teamIds = await getUserTeamIds(session.user.id);
    const [document] = await db
      .select()
      .from(documents)
      .where(documentAccessClause(params.id, session.user.id, teamIds));

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const [recipient] = await db
      .select()
      .from(recipients)
      .where(
        and(
          eq(recipients.id, params.recipientId),
          eq(recipients.documentId, params.id)
        )
      );

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    return NextResponse.json({ recipient });
  } catch (error) {
    console.error("Get recipient error:", error);
    return NextResponse.json(
      { error: "Failed to get recipient" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; recipientId: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify document access (owner or team member)
    const teamIds = await getUserTeamIds(session.user.id);
    const [document] = await db
      .select()
      .from(documents)
      .where(documentAccessClause(params.id, session.user.id, teamIds));

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const body = await request.json();
    const { email, name, orderIndex, status } = body;

    const [recipient] = await db
      .update(recipients)
      .set({
        ...(email && { email: email.trim() }),
        ...(name !== undefined && { name: name?.trim() || null }),
        ...(orderIndex !== undefined && { orderIndex }),
        ...(status && { status }),
      })
      .where(
        and(
          eq(recipients.id, params.recipientId),
          eq(recipients.documentId, params.id)
        )
      )
      .returning();

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    return NextResponse.json({ recipient });
  } catch (error) {
    console.error("Update recipient error:", error);
    return NextResponse.json(
      { error: "Failed to update recipient" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; recipientId: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify document access (owner or team member)
    const teamIds = await getUserTeamIds(session.user.id);
    const [document] = await db
      .select()
      .from(documents)
      .where(documentAccessClause(params.id, session.user.id, teamIds));

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Delete associated fields first (cascade should handle this, but being explicit)
    await db
      .delete(documentFields)
      .where(eq(documentFields.recipientId, params.recipientId));

    // Delete recipient
    const [recipient] = await db
      .delete(recipients)
      .where(
        and(
          eq(recipients.id, params.recipientId),
          eq(recipients.documentId, params.id)
        )
      )
      .returning();

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete recipient error:", error);
    return NextResponse.json(
      { error: "Failed to delete recipient" },
      { status: 500 }
    );
  }
}
