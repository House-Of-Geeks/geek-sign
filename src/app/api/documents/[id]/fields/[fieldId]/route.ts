import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, documentFields } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { documentAccessClause, getUserTeamIds } from "@/lib/db/team-access";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; fieldId: string } }
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

    const [field] = await db
      .select()
      .from(documentFields)
      .where(
        and(
          eq(documentFields.id, params.fieldId),
          eq(documentFields.documentId, params.id)
        )
      );

    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    return NextResponse.json({ field });
  } catch (error) {
    console.error("Get field error:", error);
    return NextResponse.json(
      { error: "Failed to get field" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; fieldId: string } }
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
    const { type, page, xPosition, yPosition, width, height, required, value } = body;

    const [field] = await db
      .update(documentFields)
      .set({
        ...(type && { type }),
        ...(page !== undefined && { page }),
        ...(xPosition !== undefined && { xPosition }),
        ...(yPosition !== undefined && { yPosition }),
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
        ...(required !== undefined && { required }),
        ...(value !== undefined && { value }),
      })
      .where(
        and(
          eq(documentFields.id, params.fieldId),
          eq(documentFields.documentId, params.id)
        )
      )
      .returning();

    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    return NextResponse.json({ field });
  } catch (error) {
    console.error("Update field error:", error);
    return NextResponse.json(
      { error: "Failed to update field" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; fieldId: string } }
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

    const [field] = await db
      .delete(documentFields)
      .where(
        and(
          eq(documentFields.id, params.fieldId),
          eq(documentFields.documentId, params.id)
        )
      )
      .returning();

    if (!field) {
      return NextResponse.json({ error: "Field not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete field error:", error);
    return NextResponse.json(
      { error: "Failed to delete field" },
      { status: 500 }
    );
  }
}
