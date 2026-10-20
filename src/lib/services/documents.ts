import { and, count, desc, eq, exists, ilike, inArray, or, sql } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { auditLogs, documentFields, documents, recipients, teamMembers, users } from "@/lib/db/schema";
import { documentAccessClause, getUserTeamIds } from "@/lib/db/team-access";
import { sendSenderDocumentSentEmail, sendSignerInviteEmail } from "@/lib/email";
import { APP_URL } from "@/lib/app-url";
import { fail, ok, type Actor, type ServiceResult } from "./result";

type DocumentRow = typeof documents.$inferSelect;
type RecipientRow = typeof recipients.$inferSelect;
type FieldRow = typeof documentFields.$inferSelect;

async function loadAccessibleDocument(
  documentId: string,
  userId: string,
): Promise<{ document: DocumentRow; teamIds: string[] } | undefined> {
  const teamIds = await getUserTeamIds(userId);
  const [document] = await db
    .select()
    .from(documents)
    .where(documentAccessClause(documentId, userId, teamIds));
  return document ? { document, teamIds } : undefined;
}

/** The document if the user owns it or shares a team with it. */
export async function findAccessibleDocument(
  documentId: string,
  userId: string,
): Promise<DocumentRow | undefined> {
  return (await loadAccessibleDocument(documentId, userId))?.document;
}

export async function listRecipients(documentId: string): Promise<RecipientRow[]> {
  return db.select().from(recipients).where(eq(recipients.documentId, documentId)).orderBy(recipients.orderIndex);
}

export async function getDocumentWithRecipientsAndFields(
  documentId: string,
  userId: string,
): Promise<ServiceResult<{ document: DocumentRow; recipients: RecipientRow[]; fields: FieldRow[] }>> {
  const document = await findAccessibleDocument(documentId, userId);
  if (!document) return fail(404, "Document not found");

  const documentRecipients = await listRecipients(documentId);
  const fields = await db.select().from(documentFields).where(eq(documentFields.documentId, documentId));

  return ok({ document, recipients: documentRecipients, fields });
}

const SUMMARY_COLUMNS = {
  id: documents.id,
  title: documents.title,
  status: documents.status,
  contentType: documents.contentType,
  fileName: documents.fileName,
  fileSize: documents.fileSize,
  pageCount: documents.pageCount,
  customMessage: documents.customMessage,
  senderDisplayName: documents.senderDisplayName,
  reminderEnabled: documents.reminderEnabled,
  nextReminderAt: documents.nextReminderAt,
  expiresAt: documents.expiresAt,
  completedAt: documents.completedAt,
  createdAt: documents.createdAt,
  updatedAt: documents.updatedAt,
};

export type DocumentSummaryRow = {
  [K in keyof typeof SUMMARY_COLUMNS]: DocumentRow[K];
};

export type RecipientSummary = { total: number; byStatus: Record<string, number> };

function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

/** Documents the user owns or shares through a team, newest first. No content blobs are loaded. */
export async function listAccessibleDocuments(input: {
  userId: string;
  teamIds: string[];
  status?: string;
  q?: string;
  limit: number;
  offset: number;
}): Promise<{ documents: Array<DocumentSummaryRow & { recipientSummary: RecipientSummary }>; total: number }> {
  const access =
    input.teamIds.length > 0
      ? or(eq(documents.userId, input.userId), inArray(documents.teamId, input.teamIds))
      : eq(documents.userId, input.userId);

  const pattern = input.q ? `%${escapeLike(input.q)}%` : undefined;
  const textMatch = pattern
    ? or(
        ilike(documents.title, pattern),
        exists(
          db
            .select({ one: sql`1` })
            .from(recipients)
            .where(
              and(
                eq(recipients.documentId, documents.id),
                or(ilike(recipients.email, pattern), ilike(recipients.name, pattern)),
              ),
            ),
        ),
      )
    : undefined;

  const where = and(access, input.status ? eq(documents.status, input.status) : undefined, textMatch);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(SUMMARY_COLUMNS)
      .from(documents)
      .where(where)
      .orderBy(desc(documents.createdAt))
      .limit(input.limit)
      .offset(input.offset),
    db.select({ total: count() }).from(documents).where(where),
  ]);

  const summaries = new Map<string, RecipientSummary>();
  if (rows.length > 0) {
    const counts = await db
      .select({ documentId: recipients.documentId, status: recipients.status, n: count() })
      .from(recipients)
      .where(
        inArray(
          recipients.documentId,
          rows.map((r) => r.id),
        ),
      )
      .groupBy(recipients.documentId, recipients.status);
    for (const c of counts) {
      const summary = summaries.get(c.documentId) ?? { total: 0, byStatus: {} };
      summary.total += c.n;
      summary.byStatus[c.status] = c.n;
      summaries.set(c.documentId, summary);
    }
  }

  return {
    documents: rows.map((row) => ({
      ...row,
      recipientSummary: summaries.get(row.id) ?? { total: 0, byStatus: {} },
    })),
    total: totalRow?.total ?? 0,
  };
}

/** Upload a PDF to blob storage and create a draft document, tagged with the user's first team. */
export async function createPdfDocument(input: {
  userId: string;
  title: string;
  fileName: string;
  data: Blob | Uint8Array;
  size: number;
}): Promise<DocumentRow> {
  const body = input.data instanceof Blob ? input.data : Buffer.from(input.data);
  const blob = await put(`documents/${input.userId}/${Date.now()}-${input.fileName}`, body, {
    access: "public",
    contentType: "application/pdf",
  });

  // Find user's team (if any) to tag the document
  const [membership] = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, input.userId))
    .limit(1);

  const [document] = await db
    .insert(documents)
    .values({
      userId: input.userId,
      teamId: membership?.teamId ?? null,
      title: input.title.trim(),
      fileUrl: blob.url,
      fileName: input.fileName,
      fileSize: input.size,
      status: "draft",
    })
    .returning();
  return document;
}

export type RecipientInput = { email: string; name?: string | null; orderIndex?: number | null };

/** Insert a recipient. The caller has already checked access to the document. */
export async function insertRecipient(documentId: string, input: RecipientInput): Promise<RecipientRow> {
  const [recipient] = await db
    .insert(recipients)
    .values({
      documentId,
      email: input.email.trim(),
      name: input.name?.trim() || null,
      orderIndex: input.orderIndex ?? 0,
      status: "pending",
    })
    .returning();
  return recipient;
}

export type FieldInput = {
  recipientId: string;
  type: string;
  page?: number | null;
  xPosition?: number | null;
  yPosition?: number | null;
  width?: number | null;
  height?: number | null;
  required?: boolean | null;
};

/** Insert a field for one of the document's recipients. The caller has already checked access to the document. */
export async function insertField(documentId: string, input: FieldInput): Promise<ServiceResult<FieldRow>> {
  // Verify recipient belongs to this document
  const [recipient] = await db
    .select()
    .from(recipients)
    .where(and(eq(recipients.id, input.recipientId), eq(recipients.documentId, documentId)));

  if (!recipient) return fail(404, "Recipient not found");

  const [field] = await db
    .insert(documentFields)
    .values({
      documentId,
      recipientId: input.recipientId,
      type: input.type,
      page: input.page ?? 1,
      xPosition: input.xPosition ?? 100,
      yPosition: input.yPosition ?? 100,
      width: input.width ?? 200,
      height: input.height ?? 60,
      required: input.required ?? true,
    })
    .returning();
  return ok(field);
}

export type SendOptions = {
  senderName?: string;
  senderUserId?: string;
  reminderEnabled: boolean;
  reminderIntervalDays: number;
  reminderRepeatDays: number | null;
};

/** Read the optional send settings from a loosely typed body. Anything unusable falls back to the defaults. */
export function parseSendOptions(body: unknown): SendOptions {
  const b = (body ?? {}) as Record<string, unknown>;
  const options: SendOptions = { reminderEnabled: false, reminderIntervalDays: 3, reminderRepeatDays: null };
  if (b.senderName && typeof b.senderName === "string") {
    options.senderName = b.senderName.trim() || undefined;
  }
  if (b.senderUserId && typeof b.senderUserId === "string") {
    options.senderUserId = b.senderUserId;
  }
  if (b.reminderEnabled === true) {
    options.reminderEnabled = true;
    if (typeof b.reminderIntervalDays === "number" && b.reminderIntervalDays >= 1) {
      options.reminderIntervalDays = Math.min(Math.floor(b.reminderIntervalDays), 30);
    }
    if (typeof b.reminderRepeatDays === "number" && b.reminderRepeatDays >= 1) {
      options.reminderRepeatDays = Math.min(Math.floor(b.reminderRepeatDays), 30);
    }
  }
  return options;
}

export async function sendDocument(
  documentId: string,
  actor: Actor,
  options: SendOptions,
): Promise<
  ServiceResult<{
    document: DocumentRow;
    recipients: RecipientRow[];
    message: string;
    emailsSent: number;
    emailsFailed: number;
  }>
> {
  // Get user info for email
  const [user] = await db.select().from(users).where(eq(users.id, actor.userId));

  if (!user) return fail(404, "User not found");

  // Verify document access (owner or team member)
  const access = await loadAccessibleDocument(documentId, actor.userId);
  if (!access) return fail(404, "Document not found");
  const { document, teamIds } = access;

  // Check if document has recipients
  const documentRecipients = await db.select().from(recipients).where(eq(recipients.documentId, documentId));

  if (documentRecipients.length === 0) {
    return fail(400, "Document must have at least one recipient");
  }

  // Check if document has fields
  const fields = await db.select().from(documentFields).where(eq(documentFields.documentId, documentId));

  if (fields.length === 0) {
    return fail(400, "Document must have at least one field");
  }

  const { senderName: senderNameOverride, senderUserId: senderUserIdOverride } = options;
  const { reminderEnabled, reminderIntervalDays, reminderRepeatDays } = options;

  // If delegating, validate the chosen sender is a team member sharing a
  // team with the acting user. Reassign ownership and attach a teamId so
  // the acting user retains access.
  let newOwnerUserId: string | null = null;
  let newTeamId: string | null = null;
  if (senderUserIdOverride && senderUserIdOverride !== actor.userId) {
    const senderMembership = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, senderUserIdOverride), inArray(teamMembers.teamId, teamIds)))
      .limit(1);
    if (senderMembership.length === 0) {
      return fail(400, "Selected sender is not in a shared team");
    }
    newOwnerUserId = senderUserIdOverride;
    newTeamId =
      document.teamId && teamIds.includes(document.teamId) ? document.teamId : senderMembership[0].teamId;
  }

  // Resolve the user record used for sender attribution in emails.
  let senderUser = user;
  if (newOwnerUserId) {
    const [delegated] = await db.select().from(users).where(eq(users.id, newOwnerUserId));
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
    .where(eq(documents.id, documentId))
    .returning();

  // Log the send action
  await db.insert(auditLogs).values({
    documentId,
    action: "document_sent",
    details: {
      recipientCount: documentRecipients.length,
      recipientEmails: documentRecipients.map((r) => r.email),
    },
  });

  // Send email invitations to all recipients
  const senderName =
    senderNameOverride || document.senderDisplayName || senderUser.sendAsName || senderUser.name || senderUser.email;
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
    }),
  );

  // Wait for all emails to be sent (don't fail if emails fail)
  const emailResults = await Promise.allSettled(emailPromises);
  const successfulEmails = emailResults.filter((r) => r.status === "fulfilled" && r.value === true).length;
  const failedEmails = emailResults.length - successfulEmails;

  if (failedEmails > 0) {
    console.warn(`${failedEmails} emails failed to send for document ${documentId}`);
  }

  return ok({
    document: updatedDocument,
    recipients: documentRecipients,
    message: "Document sent for signing",
    emailsSent: successfulEmails,
    emailsFailed: failedEmails,
  });
}

/**
 * Activate a document for signing WITHOUT emailing the recipients.
 *
 * Flips the document to "pending" (which makes each recipient's
 * /sign/<token> link live) and returns those links so the sender can
 * share them directly. No invitation emails are sent.
 */
export async function activateDocument(
  documentId: string,
  userId: string,
): Promise<
  ServiceResult<{
    message: string;
    links: Array<{ recipientId: string; name: string | null; email: string; url: string }>;
  }>
> {
  // Verify document access (owner or team member)
  const document = await findAccessibleDocument(documentId, userId);
  if (!document) return fail(404, "Document not found");

  // Must have at least one recipient
  const documentRecipients = await db.select().from(recipients).where(eq(recipients.documentId, documentId));

  if (documentRecipients.length === 0) {
    return fail(400, "Document must have at least one recipient");
  }

  // Must have at least one field
  const fields = await db.select().from(documentFields).where(eq(documentFields.documentId, documentId));

  if (fields.length === 0) {
    return fail(400, "Document must have at least one field");
  }

  // Only draft documents can be activated; pending docs are already live.
  if (document.status !== "draft" && document.status !== "pending") {
    return fail(400, "Only draft documents can be activated for signing");
  }

  // Flip to pending if it isn't already, which makes the signing links live.
  if (document.status === "draft") {
    await db.update(documents).set({ status: "pending", updatedAt: new Date() }).where(eq(documents.id, documentId));

    await db.insert(auditLogs).values({
      documentId,
      action: "document_sent",
      details: {
        method: "link",
        recipientCount: documentRecipients.length,
        recipientEmails: documentRecipients.map((r) => r.email),
      },
    });
  }

  const links = documentRecipients
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((r) => ({
      recipientId: r.id,
      name: r.name,
      email: r.email,
      url: `${APP_URL}/sign/${r.signingToken}`,
    }));

  return ok({ message: "Document activated for signing", links });
}

export async function resendDocument(
  documentId: string,
  actor: Actor,
): Promise<ServiceResult<{ message: string; emailsSent: number; emailsFailed: number }>> {
  // Get user info for email
  const [user] = await db.select().from(users).where(eq(users.id, actor.userId));

  if (!user) return fail(404, "User not found");

  // Verify document access (owner or team member)
  const document = await findAccessibleDocument(documentId, actor.userId);
  if (!document) return fail(404, "Document not found");

  if (document.status !== "pending") {
    return fail(400, "Can only resend emails for pending documents");
  }

  // Get all recipients who haven't signed yet (pending or viewed)
  const documentRecipients = await db.select().from(recipients).where(eq(recipients.documentId, documentId));

  // Filter to only recipients who haven't signed
  const pendingRecipients = documentRecipients.filter((r) => r.status !== "signed" && r.status !== "declined");

  if (pendingRecipients.length === 0) {
    return fail(400, "All recipients have already signed or declined");
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
  const successfulEmails = emailResults.filter((r) => r.status === "fulfilled" && r.value === true).length;
  const failedEmails = emailResults.length - successfulEmails;

  if (failedEmails > 0) {
    console.warn(`${failedEmails} emails failed to send for document ${documentId}`);
  }

  return ok({ message: "Emails resent", emailsSent: successfulEmails, emailsFailed: failedEmails });
}
