import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { activateDocument } from "@/lib/services/documents";

/**
 * Activate a document for signing WITHOUT emailing the recipients.
 *
 * Flips the document to "pending" (which makes each recipient's
 * /sign/<token> link live) and returns those links so the sender can
 * share them directly. No invitation emails are sent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await activateDocument(params.id, session.user.id);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Activate document error:", error);
    return NextResponse.json(
      { error: "Failed to activate document" },
      { status: 500 }
    );
  }
}
