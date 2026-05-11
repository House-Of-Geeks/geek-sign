import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, teamMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canUseRichtext } from "@/lib/features";

/**
 * POST /api/documents — JSON body for richtext one-off documents.
 * PDF uploads continue to use POST /api/documents/upload (FormData).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return NextResponse.json(
        { error: "Use /api/documents/upload for PDF uploads" },
        { status: 415 }
      );
    }

    if (!(await canUseRichtext(session.user.id))) {
      return NextResponse.json(
        { error: "On-platform composition is not enabled for this account" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const title = (body.title as string | undefined)?.trim() || "Untitled document";
    const requestedContentType = (body.contentType as string | undefined) ?? "richtext";
    if (requestedContentType !== "richtext") {
      return NextResponse.json(
        { error: "Unsupported contentType for JSON create" },
        { status: 400 }
      );
    }

    const [membership] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, session.user.id))
      .limit(1);

    const [document] = await db
      .insert(documents)
      .values({
        userId: session.user.id,
        teamId: membership?.teamId ?? null,
        title,
        contentType: "richtext",
        content: body.content ?? null,
        recipientRoles: body.recipientRoles ?? null,
        variables: body.variables ?? null,
        fileUrl: null,
        fileName: null,
        status: "draft",
      })
      .returning();

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Create document error:", error);
    return NextResponse.json(
      { error: "Failed to create document" },
      { status: 500 }
    );
  }
}
