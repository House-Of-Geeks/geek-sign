import { NextResponse } from "next/server";
import { AssistantSendSchema, presentDocument, presentRecipient } from "@/lib/assistant";
import { HttpError, assistantErrorResponse, readJsonBody, requireAssistant, serviceErrorResponse, requireUuid } from "@/lib/assistantAccess";
import { APP_URL } from "@/lib/app-url";
import { findAccessibleDocument, parseSendOptions, sendDocument } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAssistant(request);
    requireUuid(params.id, "Document not found");
    const body = AssistantSendSchema.parse(await readJsonBody(request, { allowEmpty: true }));

    // Sending a finished or voided document would put it back to pending.
    const document = await findAccessibleDocument(params.id, user.id);
    if (!document) throw new HttpError(404, "Document not found");
    if (document.status !== "draft") {
      throw new HttpError(
        409,
        `Only draft documents can be sent. This document is ${document.status}; use resend to remind signers.`,
      );
    }

    const result = await sendDocument(params.id, { userId: user.id, email: user.email }, parseSendOptions(body));
    if (!result.ok) return serviceErrorResponse(result);

    const { document: sent, recipients, message, emailsSent, emailsFailed } = result.data;
    return NextResponse.json({
      document: presentDocument(sent, APP_URL),
      recipients: recipients.map(presentRecipient),
      emailsSent,
      emailsFailed,
      message,
    });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
