import { NextResponse } from "next/server";
import { AssistantUpdateRecipientSchema, presentRecipient } from "@/lib/assistant";
import {
  assistantErrorResponse,
  readJsonBody,
  requireAssistant,
  requireUuid,
  serviceErrorResponse,
} from "@/lib/assistantAccess";
import { deleteDocumentRecipient, updateDocumentRecipient } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: { id: string; recipientId: string } };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { user } = await requireAssistant(request);
    requireUuid(params.id, "Document not found");
    requireUuid(params.recipientId, "Recipient not found");
    const updates = AssistantUpdateRecipientSchema.parse(await readJsonBody(request));

    const result = await updateDocumentRecipient(params.id, params.recipientId, user.id, updates, {
      draftOnly: true,
    });
    if (!result.ok) return serviceErrorResponse(result);

    return NextResponse.json({ recipient: presentRecipient(result.data) });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { user } = await requireAssistant(request);
    requireUuid(params.id, "Document not found");
    requireUuid(params.recipientId, "Recipient not found");

    const result = await deleteDocumentRecipient(params.id, params.recipientId, user.id, { draftOnly: true });
    if (!result.ok) return serviceErrorResponse(result);

    return NextResponse.json({
      deleted: true,
      recipientId: result.data.recipientId,
      fieldsDeleted: result.data.fieldsDeleted,
    });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
