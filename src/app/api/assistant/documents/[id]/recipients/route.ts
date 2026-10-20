import { NextResponse } from "next/server";
import { normaliseRecipients, presentRecipient } from "@/lib/assistant";
import { HttpError, assistantErrorResponse, readJsonBody, requireAssistant, serviceErrorResponse, requireUuid } from "@/lib/assistantAccess";
import { findAccessibleDocument, insertField, insertRecipient } from "@/lib/services/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireAssistant(request);
    requireUuid(params.id, "Document not found");
    const inputs = normaliseRecipients(await readJsonBody(request));

    const document = await findAccessibleDocument(params.id, user.id);
    if (!document) throw new HttpError(404, "Document not found");
    if (document.status !== "draft") {
      throw new HttpError(
        409,
        `Recipients can only be added to draft documents. This document is ${document.status}.`,
      );
    }

    const created = [];
    let fieldsCreated = 0;
    for (const input of inputs) {
      const recipient = await insertRecipient(document.id, {
        email: input.email,
        name: input.name,
        orderIndex: input.orderIndex,
      });
      created.push(recipient);

      for (const field of input.fields ?? []) {
        // Positions are stored as whole numbers (PDF points from the top-left of the page).
        const result = await insertField(document.id, {
          recipientId: recipient.id,
          type: field.type,
          page: field.page,
          xPosition: Math.round(field.xPosition),
          yPosition: Math.round(field.yPosition),
          width: Math.max(1, Math.round(field.width)),
          height: Math.max(1, Math.round(field.height)),
          required: field.required,
        });
        if (!result.ok) return serviceErrorResponse(result);
        fieldsCreated += 1;
      }
    }

    return NextResponse.json({ recipients: created.map(presentRecipient), fieldsCreated }, { status: 201 });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
