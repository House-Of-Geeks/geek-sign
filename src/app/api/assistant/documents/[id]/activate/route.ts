import { NextResponse } from "next/server";
import { assistantErrorResponse, readJsonBody, requireAssistant, serviceErrorResponse, requireUuid } from "@/lib/assistantAccess";
import { activateDocument } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Make the signing links live without emailing anyone, and hand the links back. */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAssistant(request);
    requireUuid(params.id, "Document not found");
    await readJsonBody(request, { allowEmpty: true });

    const result = await activateDocument(params.id, user.id);
    if (!result.ok) return serviceErrorResponse(result);

    return NextResponse.json(result.data);
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
