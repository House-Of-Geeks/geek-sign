import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { documentAccessClause, getUserTeamIds } from "@/lib/db/team-access";
import { deleteDocument, getDocumentWithRecipientsAndFields } from "@/lib/services/documents";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await getDocumentWithRecipientsAndFields(params.id, session.user.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data);
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

    const updates: Partial<typeof documents.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (title) updates.title = title;
    if (status) updates.status = status;
    // Richtext composer autosave
    if ("content" in body) updates.content = body.content ?? null;
    if ("recipientRoles" in body) updates.recipientRoles = body.recipientRoles ?? null;
    if ("variables" in body) updates.variables = body.variables ?? null;

    const teamIds = await getUserTeamIds(session.user.id);
    const [document] = await db
      .update(documents)
      .set(updates)
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

    const result = await deleteDocument(params.id, session.user.id, { draftOnly: false });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
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
