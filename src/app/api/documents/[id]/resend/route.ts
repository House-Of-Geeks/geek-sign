import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resendDocument } from "@/lib/services/documents";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await resendDocument(params.id, {
      userId: session.user.id,
      email: session.user.email,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    console.error("Resend emails error:", error);
    return NextResponse.json(
      { error: "Failed to resend emails" },
      { status: 500 }
    );
  }
}
