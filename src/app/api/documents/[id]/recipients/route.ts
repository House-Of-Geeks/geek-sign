import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, recipients } from "@/lib/db/schema";
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

    // Verify document access (owner or team member)
    const teamIds = await getUserTeamIds(session.user.id);
    const [document] = await db
      .select()
      .from(documents)
      .where(documentAccessClause(params.id, session.user.id, teamIds));

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const documentRecipients = await db
      .select()
      .from(recipients)
      .where(eq(recipients.documentId, params.id))
      .orderBy(recipients.orderIndex);

    return NextResponse.json({ recipients: documentRecipients });
  } catch (error) {
    console.error("Get recipients error:", error);
    return NextResponse.json(
      { error: "Failed to get recipients" },
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
    const { email, name, orderIndex } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const [recipient] = await db
      .insert(recipients)
      .values({
        documentId: params.id,
        email: email.trim(),
        name: name?.trim() || null,
        orderIndex: orderIndex ?? 0,
        status: "pending",
      })
      .returning();

    return NextResponse.json({ recipient });
  } catch (error) {
    console.error("Create recipient error:", error);
    return NextResponse.json(
      { error: "Failed to create recipient" },
      { status: 500 }
    );
  }
}
