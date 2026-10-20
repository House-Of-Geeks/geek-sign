import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { parseSendOptions, sendDocument } from "@/lib/services/documents";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Optional sender name override, sender delegation, and reminder config.
    // The body may be empty, which is fine.
    const body = await request.json().catch(() => null);

    const result = await sendDocument(
      params.id,
      { userId: session.user.id, email: session.user.email },
      parseSendOptions(body)
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Send document error:", error);
    return NextResponse.json(
      { error: "Failed to send document" },
      { status: 500 }
    );
  }
}
