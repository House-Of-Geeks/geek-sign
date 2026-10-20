import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildSignedDownloadResponse } from "@/lib/services/signed-pdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    return await buildSignedDownloadResponse(
      id,
      { userId: session.user.id, email: session.user.email },
      request
    );
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to generate signed document" },
      { status: 500 }
    );
  }
}
