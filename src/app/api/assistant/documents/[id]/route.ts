import { NextResponse } from "next/server";
import { presentDocument, presentRecipient } from "@/lib/assistant";
import { assistantErrorResponse, requireAssistant, serviceErrorResponse, requireUuid } from "@/lib/assistantAccess";
import { APP_URL } from "@/lib/app-url";
import { getDocumentWithRecipientsAndFields } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAssistant(request);
    requireUuid(params.id, "Document not found");
    const result = await getDocumentWithRecipientsAndFields(params.id, user.id);
    if (!result.ok) return serviceErrorResponse(result);

    const { document, recipients, fields } = result.data;
    const isComplete = (value: string | null) => Boolean(value && value.length > 0);

    return NextResponse.json({
      document: presentDocument(document, APP_URL),
      recipients: recipients.map((recipient) => {
        const own = fields.filter((f) => f.recipientId === recipient.id);
        return {
          ...presentRecipient(recipient),
          fieldCount: own.length,
          completedFieldCount: own.filter((f) => isComplete(f.value)).length,
        };
      }),
      fields: {
        total: fields.length,
        completed: fields.filter((f) => isComplete(f.value)).length,
      },
    });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
