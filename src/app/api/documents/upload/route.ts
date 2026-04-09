import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, teamMembers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!title) {
      return NextResponse.json({ error: "No title provided" }, { status: 400 });
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    // Upload file to Vercel Blob
    const blob = await put(`documents/${session.user.id}/${Date.now()}-${file.name}`, file, {
      access: "public",
      contentType: "application/pdf",
    });

    // Find user's team (if any) to tag the document
    const [membership] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, session.user.id))
      .limit(1);

    // Create document record in database
    const [document] = await db
      .insert(documents)
      .values({
        userId: session.user.id,
        teamId: membership?.teamId ?? null,
        title: title.trim(),
        fileUrl: blob.url,
        fileName: file.name,
        fileSize: file.size,
        status: "draft",
      })
      .returning();

    return NextResponse.json({ document });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload document" },
      { status: 500 }
    );
  }
}
