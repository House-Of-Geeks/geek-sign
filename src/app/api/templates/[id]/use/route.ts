import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { findAccessibleTemplate, createDocumentFromTemplate } from "@/lib/services/templates";

// POST use template to create a new document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      // An unreadable body only matters once the template is known to exist.
      if (!(await findAccessibleTemplate(id, session.user.id))) {
        return NextResponse.json({ error: "Template not found" }, { status: 404 });
      }
      throw parseError;
    }

    const result = await createDocumentFromTemplate(
      id,
      { userId: session.user.id, email: session.user.email },
      body
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (error) {
    console.error("Error using template:", error);
    return NextResponse.json(
      { error: "Failed to create document from template" },
      { status: 500 }
    );
  }
}
