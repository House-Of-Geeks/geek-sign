import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, recipients, documentFields, users, auditLogs, teamMembers } from "@/lib/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { documentAccessClause, getUserTeamIds } from "@/lib/db/team-access";
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

    // Verify document access (owner or team member)
    const teamIds = await getUserTeamIds(session.user.id);
    const [document] = await db
      .select()
      .from(documents)
      .where(documentAccessClause(params.id, session.user.id, teamIds));

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

    // Read optional sender name override, sender delegation, and reminder
    // config from request body
    let senderNameOverride: string | undefined;
    let senderUserIdOverride: string | undefined;
    let reminderEnabled = false;
    let reminderIntervalDays = 3;
    let reminderRepeatDays: number | null = null;
    try {
      const body = await request.json();
      if (body?.senderName && typeof body.senderName === "string") {
        senderNameOverride = body.senderName.trim() || undefined;
      }
      if (body?.senderUserId && typeof body.senderUserId === "string") {
        senderUserIdOverride = body.senderUserId;
      }
      if (body?.reminderEnabled === true) {
        reminderEnabled = true;
        if (typeof body.reminderIntervalDays === "number" && body.reminderIntervalDays >= 1) {
          reminderIntervalDays = Math.min(Math.floor(body.reminderIntervalDays), 30);
        }
        if (typeof body.reminderRepeatDays === "number" && body.reminderRepeatDays >= 1) {
          reminderRepeatDays = Math.min(Math.floor(body.reminderRepeatDays), 30);
        }
      }
    } catch {
      // body may be empty — that's fine
    }

    // If delegating, validate the chosen sender is a team member sharing a
    // team with the session user. Reassign ownership and attach a teamId so
    // the session user retains access.
    let newOwnerUserId: string | null = null;
    let newTeamId: string | null = null;
    if (senderUserIdOverride && senderUserIdOverride !== session.user.id) {
      const senderMembership = await db
        .select({ teamId: teamMembers.teamId })
        .from(teamMembers)
        .where(
          and(
            eq(teamMembers.userId, senderUserIdOverride),
            inArray(teamMembers.teamId, teamIds)
          )
        )
        .limit(1);
      if (senderMembership.length === 0) {
        return NextResponse.json(
          { error: "Selected sender is not in a shared team" },
          { status: 400 }
        );
      }
      newOwnerUserId = senderUserIdOverride;
      newTeamId =
        document.teamId && teamIds.includes(document.teamId)
          ? document.teamId
          : senderMembership[0].teamId;
    }

    // Resolve the user record used for sender attribution in emails.
    let senderUser = user;
    if (newOwnerUserId) {
      const [delegated] = await db
        .select()
        .from(users)
        .where(eq(users.id, newOwnerUserId));
      if (delegated) senderUser = delegated;
    }

    // Compute first reminder timestamp
    const nextReminderAt = reminderEnabled
      ? new Date(Date.now() + reminderIntervalDays * 24 * 60 * 60 * 1000)
      : null;

    // Update document status to pending, applying delegation if requested
    const [updatedDocument] = await db
      .update(documents)
      .set({
        status: "pending",
        ...(newOwnerUserId && { userId: newOwnerUserId, teamId: newTeamId }),
        ...(senderNameOverride && { senderDisplayName: senderNameOverride }),
        reminderEnabled,
        reminderIntervalDays,
        reminderRepeatDays,
        nextReminderAt,
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
    const senderName = senderNameOverride || document.senderDisplayName || senderUser.sendAsName || senderUser.name || senderUser.email;
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
        senderEmail: senderUser.email,
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
