import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, recipients, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { sendSignerInviteEmail } from "@/lib/email";

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

    // Verify document ownership and status
    const [document] = await db
      .select()
      .from(documents)
      .where(
        and(eq(documents.id, params.id), eq(documents.userId, session.user.id))
      );

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.status !== "pending") {
      return NextResponse.json(
        { error: "Can only resend emails for pending documents" },
        { status: 400 }
      );
    }

    // Get all recipients who haven't signed yet (pending or viewed)
    const documentRecipients = await db
      .select()
      .from(recipients)
      .where(eq(recipients.documentId, params.id));

    // Filter to only recipients who haven't signed
    const pendingRecipients = documentRecipients.filter(
      (r) => r.status !== "signed" && r.status !== "declined"
    );

    if (pendingRecipients.length === 0) {
      return NextResponse.json(
        { error: "All recipients have already signed or declined" },
        { status: 400 }
      );
    }

    // Send email invitations to pending recipients
    const senderName = user.sendAsName || user.name || user.email;
    const emailPromises = pendingRecipients.map((recipient) => {
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

    // Wait for all emails to be sent
    const emailResults = await Promise.allSettled(emailPromises);
    const successfulEmails = emailResults.filter(
      (r) => r.status === "fulfilled" && r.value === true
    ).length;
    const failedEmails = emailResults.length - successfulEmails;

    if (failedEmails > 0) {
      console.warn(`${failedEmails} emails failed to send for document ${params.id}`);
    }

    return NextResponse.json({
      message: "Emails resent",
      emailsSent: successfulEmails,
      emailsFailed: failedEmails,
    });
  } catch (error) {
    console.error("Resend emails error:", error);
    return NextResponse.json(
      { error: "Failed to resend emails" },
      { status: 500 }
    );
  }
}
