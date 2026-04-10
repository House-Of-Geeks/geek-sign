import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, recipients, documentFields, users, auditLogs } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import {
  sendSignerCompletedEmail,
  sendSignerDocumentCompletedEmail,
  sendSenderDocumentSignedEmail,
  sendSenderDocumentCompletedEmail,
} from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sign.houseofgeeks.online";

interface FieldUpdate {
  id: string;
  value: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { fields } = await request.json() as { fields: FieldUpdate[] };

    // Find recipient by signing token
    const [recipient] = await db
      .select()
      .from(recipients)
      .where(eq(recipients.signingToken, params.token));

    if (!recipient) {
      return NextResponse.json(
        { error: "Invalid signing link" },
        { status: 404 }
      );
    }

    if (recipient.status === "signed") {
      return NextResponse.json(
        { error: "Document has already been signed" },
        { status: 400 }
      );
    }

    // Verify ESIGN consent was given
    if (!recipient.consentGiven) {
      return NextResponse.json(
        { error: "ESIGN consent is required before signing" },
        { status: 400 }
      );
    }

    // Get document
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, recipient.documentId));

    if (!document || document.status === "draft") {
      return NextResponse.json(
        { error: "Document not available for signing" },
        { status: 400 }
      );
    }

    // Get IP address and user agent for audit log
    const ipAddress = request.headers.get("x-forwarded-for") ||
                      request.headers.get("x-real-ip") ||
                      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Update all field values — including nulls to honour clears/skips
    for (const field of fields) {
      if (!field.id) continue;
      await db
        .update(documentFields)
        .set({ value: field.value ?? null })
        .where(
          and(
            eq(documentFields.id, field.id),
            eq(documentFields.recipientId, recipient.id)
          )
        );
    }

    // Update recipient status
    await db
      .update(recipients)
      .set({
        status: "signed",
        signedAt: new Date(),
        ipAddress,
      })
      .where(eq(recipients.id, recipient.id));

    // Log the signing with full audit trail
    await db.insert(auditLogs).values({
      documentId: document.id,
      recipientId: recipient.id,
      action: "document_signed",
      ipAddress,
      details: {
        recipientEmail: recipient.email,
        fieldsCompleted: fields.filter((f) => f.value).length,
        userAgent,
        consentTimestamp: recipient.consentTimestamp,
        signedAt: new Date().toISOString(),
      },
    });

    // Check if all recipients have signed
    const allRecipients = await db
      .select()
      .from(recipients)
      .where(eq(recipients.documentId, document.id));

    const unsignedRecipients = allRecipients.filter((r) => r.status !== "signed");
    const allSigned = unsignedRecipients.length === 0;

    // Get sender info
    const [sender] = await db
      .select()
      .from(users)
      .where(eq(users.id, document.userId));

    const documentUrl = `${APP_URL}/dashboard/documents/${document.id}`;

    // Send confirmation to signer
    await sendSignerCompletedEmail({
      signerName: recipient.name,
      signerEmail: recipient.email,
      documentTitle: document.title,
    });

    if (sender) {
      if (allSigned) {
        // All recipients have signed - mark document as completed
        await db
          .update(documents)
          .set({
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(documents.id, document.id));

        // Log completion
        await db.insert(auditLogs).values({
          documentId: document.id,
          action: "document_completed",
          details: {
            totalRecipients: allRecipients.length,
          },
        });

        // Send completion email to sender
        await sendSenderDocumentCompletedEmail({
          senderName: sender.name || sender.email,
          senderEmail: sender.email,
          documentTitle: document.title,
          documentUrl,
        });

        // Notify all signers that the document is fully executed
        await Promise.all(
          allRecipients.map((r) =>
            sendSignerDocumentCompletedEmail({
              signerName: r.name,
              signerEmail: r.email,
              documentTitle: document.title,
              downloadUrl: `${APP_URL}/api/sign/${r.signingToken}/download`,
            })
          )
        );
      } else {
        // Notify sender that this recipient signed
        await sendSenderDocumentSignedEmail({
          senderName: sender.name || sender.email,
          senderEmail: sender.email,
          documentTitle: document.title,
          signerName: recipient.name,
          signerEmail: recipient.email,
          remainingSigners: unsignedRecipients.length,
          documentUrl,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Document signed successfully",
      documentCompleted: allSigned,
    });
  } catch (error) {
    console.error("Complete signing error:", error);
    return NextResponse.json(
      { error: "Failed to complete signing" },
      { status: 500 }
    );
  }
}
