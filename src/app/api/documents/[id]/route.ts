import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, recipients, documentFields } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { documentAccessClause, getUserTeamIds } from "@/lib/db/team-access";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamIds = await getUserTeamIds(session.user.id);
    const [document] = await db
      .select()
      .from(documents)
      .where(documentAccessClause(params.id, session.user.id, teamIds));

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Get recipients
    const documentRecipients = await db
      .select()
      .from(recipients)
      .where(eq(recipients.documentId, params.id))
      .orderBy(recipients.orderIndex);

    // Get fields
    const fields = await db
      .select()
      .from(documentFields)
      .where(eq(documentFields.documentId, params.id));

    return NextResponse.json({
      document,
      recipients: documentRecipients,
      fields,
    });
  } catch (error) {
    console.error("Get document error:", error);
    return NextResponse.json(
      { error: "Failed to get document" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, status } = body;

    const teamIds = await getUserTeamIds(session.user.id);
    const [document] = await db
      .update(documents)
      .set({
        ...(title && { title }),
        ...(status && { status }),
        updatedAt: new Date(),
      })
      .where(documentAccessClause(params.id, session.user.id, teamIds))
      .returning();

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Update document error:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamIds = await getUserTeamIds(session.user.id);
    const [document] = await db
      .delete(documents)
      .where(documentAccessClause(params.id, session.user.id, teamIds))
      .returning();

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete document error:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
