import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, recipients, documentFields, users, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { sendSenderDocumentViewedEmail } from "@/lib/email";
import { plansConfig } from "@/config/plans";
import type { Plan } from "@/types";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sign.houseofgeeks.online";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
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

    // Get document
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, recipient.documentId));

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Check if document is still pending or completed
    if (document.status === "draft") {
      return NextResponse.json(
        { error: "Document has not been sent for signing yet" },
        { status: 400 }
      );
    }

    if (document.status === "expired") {
      return NextResponse.json(
        { error: "This signing link has expired" },
        { status: 400 }
      );
    }

    // Get fields for this recipient
    const fields = await db
      .select()
      .from(documentFields)
      .where(eq(documentFields.recipientId, recipient.id));

    // Get all recipients to check if document is fully signed
    const allRecipients = await db
      .select()
      .from(recipients)
      .where(eq(recipients.documentId, document.id));

    const allSigned = allRecipients.every((r) => r.status === "signed");
    const totalRecipients = allRecipients.length;
    const signedCount = allRecipients.filter((r) => r.status === "signed").length;

    // If not already viewed, mark as viewed and notify sender
    if (!recipient.viewedAt) {
      // Update recipient viewedAt
      await db
        .update(recipients)
        .set({ viewedAt: new Date() })
        .where(eq(recipients.id, recipient.id));

      // Log the view
      const ipAddress = request.headers.get("x-forwarded-for") ||
                        request.headers.get("x-real-ip") ||
                        "unknown";

      await db.insert(auditLogs).values({
        documentId: document.id,
        recipientId: recipient.id,
        action: "document_viewed",
        ipAddress,
        details: { recipientEmail: recipient.email },
      });

      // Get sender info and notify them (only for paid plans with notifyOnOpen feature)
      const [sender] = await db
        .select()
        .from(users)
        .where(eq(users.id, document.userId));

      if (sender) {
        // Check if sender's plan has notifyOnOpen feature
        const isSuperAdmin = sender.isSuperAdmin ?? false;
        const effectivePlan = isSuperAdmin ? "team" : (sender.plan || "free") as Plan;
        const planConfig = plansConfig[effectivePlan];

        if (planConfig.limits.notifyOnOpen) {
          const documentUrl = `${APP_URL}/dashboard/documents/${document.id}`;
          await sendSenderDocumentViewedEmail({
            senderName: sender.name || sender.email,
            senderEmail: sender.email,
            documentTitle: document.title,
            viewerName: recipient.name,
            viewerEmail: recipient.email,
            documentUrl,
          });
        }
      }
    }

    // Check if recipient is a registered user with a saved signature
    const [signingUser] = await db
      .select({ savedSignature: users.savedSignature, savedInitials: users.savedInitials })
      .from(users)
      .where(eq(users.email, recipient.email))
      .limit(1);

    return NextResponse.json({
      document: {
        id: document.id,
        title: document.title,
        fileUrl: document.fileUrl,
        status: document.status,
        isFullySigned: allSigned,
        totalRecipients,
        signedCount,
      },
      recipient: {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
        status: recipient.status,
        consentGiven: recipient.consentGiven || false,
      },
      savedSignature: signingUser?.savedSignature ?? null,
      savedInitials: signingUser?.savedInitials ?? null,
      fields: fields.map((f) => ({
        id: f.id,
        type: f.type,
        xPosition: f.xPosition,
        yPosition: f.yPosition,
        width: f.width,
        height: f.height,
        page: f.page,
        value: f.value,
        required: f.required,
      })),
    });
  } catch (error) {
    console.error("Get signing data error:", error);
    return NextResponse.json(
      { error: "Failed to load signing data" },
      { status: 500 }
    );
  }
}
