import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, recipients, documentFields, users, auditLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  sendSignerInviteEmail,
  sendSenderDocumentSentEmail,
} from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sign.houseofgeeks.online";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user info for email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify document ownership
    const [document] = await db
      .select()
      .from(documents)
      .where(
        and(eq(documents.id, params.id), eq(documents.userId, session.user.id))
      );

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Check if document has recipients
    const documentRecipients = await db
      .select()
      .from(recipients)
      .where(eq(recipients.documentId, params.id));

    if (documentRecipients.length === 0) {
      return NextResponse.json(
        { error: "Document must have at least one recipient" },
        { status: 400 }
      );
    }

    // Check if document has fields
    const fields = await db
      .select()
      .from(documentFields)
      .where(eq(documentFields.documentId, params.id));

    if (fields.length === 0) {
      return NextResponse.json(
        { error: "Document must have at least one field" },
        { status: 400 }
      );
    }

    // Read optional sender name override from request body
    let senderNameOverride: string | undefined;
    try {
      const body = await request.json();
      if (body?.senderName && typeof body.senderName === "string") {
        senderNameOverride = body.senderName.trim() || undefined;
      }
    } catch {
      // body may be empty — that's fine
    }

    // Update document status to pending
    const [updatedDocument] = await db
      .update(documents)
      .set({
        status: "pending",
        updatedAt: new Date(),
      })
      .where(eq(documents.id, params.id))
      .returning();

    // Log the send action
    await db.insert(auditLogs).values({
      documentId: params.id,
      action: "document_sent",
      details: {
        recipientCount: documentRecipients.length,
        recipientEmails: documentRecipients.map((r) => r.email),
      },
    });

    // Send email invitations to all recipients
    const senderName = senderNameOverride || user.sendAsName || user.name || user.email;
    const emailPromises = documentRecipients.map((recipient) => {
      const signUrl = `${APP_URL}/sign/${recipient.signingToken}`;
      return sendSignerInviteEmail({
        signerName: recipient.name,
        signerEmail: recipient.email,
        senderName,
        documentTitle: document.title,
        signUrl,
        message: document.customMessage || undefined,
      });
    });

    // Send confirmation to sender
    const documentUrl = `${APP_URL}/dashboard/documents/${document.id}`;
    emailPromises.push(
      sendSenderDocumentSentEmail({
        senderName,
        senderEmail: user.email,
        documentTitle: document.title,
        recipientCount: documentRecipients.length,
        recipientEmails: documentRecipients.map((r) => r.email),
        documentUrl,
      })
    );

    // Wait for all emails to be sent (don't fail if emails fail)
    const emailResults = await Promise.allSettled(emailPromises);
    const successfulEmails = emailResults.filter(
      (r) => r.status === "fulfilled" && r.value === true
    ).length;
    const failedEmails = emailResults.length - successfulEmails;

    if (failedEmails > 0) {
      console.warn(`${failedEmails} emails failed to send for document ${params.id}`);
    }

    return NextResponse.json({
      document: updatedDocument,
      recipients: documentRecipients,
      message: "Document sent for signing",
      emailsSent: successfulEmails,
      emailsFailed: failedEmails,
    });
  } catch (error) {
    console.error("Send document error:", error);
    return NextResponse.json(
      { error: "Failed to send document" },
      { status: 500 }
    );
  }
}
