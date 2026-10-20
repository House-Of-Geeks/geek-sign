import { assistantErrorResponse, requireAssistant, requireUuid } from "@/lib/assistantAccess";
import { buildSignedDownloadResponse } from "@/lib/services/signed-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAssistant(request);
    requireUuid(params.id, "Document not found");
    return await buildSignedDownloadResponse(params.id, { userId: user.id, email: user.email }, request);
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
