import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, documentFields, recipients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

    // Verify document access (owner or team member)
    const teamIds = await getUserTeamIds(session.user.id);
    const [document] = await db
      .select()
      .from(documents)
      .where(documentAccessClause(params.id, session.user.id, teamIds));

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const fields = await db
      .select()
      .from(documentFields)
      .where(eq(documentFields.documentId, params.id));

    return NextResponse.json({ fields });
  } catch (error) {
    console.error("Get fields error:", error);
    return NextResponse.json(
      { error: "Failed to get fields" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
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
    const { recipientId, type, page, xPosition, yPosition, width, height, required } = body;

    if (!recipientId || !type) {
      return NextResponse.json(
        { error: "Recipient ID and type are required" },
        { status: 400 }
      );
    }

    // Verify recipient belongs to this document
    const [recipient] = await db
      .select()
      .from(recipients)
      .where(
        and(
          eq(recipients.id, recipientId),
          eq(recipients.documentId, params.id)
        )
      );

    if (!recipient) {
      return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
    }

    const [field] = await db
      .insert(documentFields)
      .values({
        documentId: params.id,
        recipientId,
        type,
        page: page ?? 1,
        xPosition: xPosition ?? 100,
        yPosition: yPosition ?? 100,
        width: width ?? 200,
        height: height ?? 60,
        required: required ?? true,
      })
      .returning();

    return NextResponse.json({ field });
  } catch (error) {
    console.error("Create field error:", error);
    return NextResponse.json(
      { error: "Failed to create field" },
      { status: 500 }
    );
  }
}
