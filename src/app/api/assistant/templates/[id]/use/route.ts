import { NextResponse } from "next/server";
import { AssistantUseTemplateSchema, presentDocument, presentRecipient, toRecipientEmails } from "@/lib/assistant";
import { assistantErrorResponse, readJsonBody, requireAssistant, serviceErrorResponse, requireUuid } from "@/lib/assistantAccess";
import { APP_URL } from "@/lib/app-url";
import { listRecipients } from "@/lib/services/documents";
import { createDocumentFromTemplate } from "@/lib/services/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAssistant(request);
    requireUuid(params.id, "Template not found");
    const body = AssistantUseTemplateSchema.parse(await readJsonBody(request));

    const result = await createDocumentFromTemplate(
      params.id,
      { userId: user.id, email: user.email },
      {
        title: body.title,
        recipientEmails: toRecipientEmails(body.recipients),
        customMessage: body.customMessage,
        senderDisplayName: body.senderDisplayName,
        variables: body.variables,
        senderFieldValues: body.senderFieldValues,
      },
    );
    if (!result.ok) return serviceErrorResponse(result);

    const recipients = await listRecipients(result.data.document.id);
    return NextResponse.json(
      { document: presentDocument(result.data.document, APP_URL), recipients: recipients.map(presentRecipient) },
      { status: 201 },
    );
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
