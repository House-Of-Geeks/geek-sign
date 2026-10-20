import { NextResponse } from "next/server";
import { assistantErrorResponse, readJsonBody, requireAssistant, serviceErrorResponse, requireUuid } from "@/lib/assistantAccess";
import { resendDocument } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAssistant(request);
    requireUuid(params.id, "Document not found");
    await readJsonBody(request, { allowEmpty: true });

    const result = await resendDocument(params.id, { userId: user.id, email: user.email });
    if (!result.ok) return serviceErrorResponse(result);

    return NextResponse.json(result.data);
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
