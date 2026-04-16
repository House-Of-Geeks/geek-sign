import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, recipients, users, auditLogs } from "@/lib/db/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { sendSignerReminderEmail } from "@/lib/email";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sign.houseofgeeks.online";

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  let documentsProcessed = 0;
  let remindersSent = 0;
  const errors: string[] = [];

  // Find pending documents with reminders due
  const dueDocs = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.status, "pending"),
        eq(documents.reminderEnabled, true),
        isNotNull(documents.nextReminderAt),
        lte(documents.nextReminderAt, now)
      )
    );

  for (const doc of dueDocs) {
    documentsProcessed++;

    try {
      // Get the sender
      const [sender] = await db.select().from(users).where(eq(users.id, doc.userId));
      if (!sender) continue;

      // Get recipients who haven't signed or declined
      const allRecipients = await db
        .select()
        .from(recipients)
        .where(eq(recipients.documentId, doc.id));

      const unsignedRecipients = allRecipients.filter(
        (r) => r.status !== "signed" && r.status !== "declined"
      );

      if (unsignedRecipients.length === 0) {
        // All done — clear reminders
        await db
          .update(documents)
          .set({ reminderEnabled: false, nextReminderAt: null, updatedAt: now })
          .where(eq(documents.id, doc.id));
        continue;
      }

      const senderName =
        doc.senderDisplayName || sender.sendAsName || sender.name || sender.email;

      // Send reminder to each unsigned recipient
      for (const recipient of unsignedRecipients) {
        const signUrl = `${APP_URL}/sign/${recipient.signingToken}`;
        const sent = await sendSignerReminderEmail({
          signerName: recipient.name,
          signerEmail: recipient.email,
          senderName,
          documentTitle: doc.title,
          signUrl,
        });
        if (sent) remindersSent++;
      }

      // Audit log
      await db.insert(auditLogs).values({
        documentId: doc.id,
        action: "auto_reminder_sent",
        details: {
          recipientCount: unsignedRecipients.length,
          recipientEmails: unsignedRecipients.map((r) => r.email),
        },
      });

      // Advance or clear nextReminderAt
      const nextReminderAt =
        doc.reminderRepeatDays && doc.reminderRepeatDays > 0
          ? new Date(now.getTime() + doc.reminderRepeatDays * 24 * 60 * 60 * 1000)
          : null;

      await db
        .update(documents)
        .set({ nextReminderAt, updatedAt: now })
        .where(eq(documents.id, doc.id));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`doc ${doc.id}: ${msg}`);
      console.error(`Auto-reminder error for document ${doc.id}:`, err);
    }
  }

  return NextResponse.json({
    success: true,
    documentsProcessed,
    remindersSent,
    ...(errors.length > 0 && { errors }),
  });
}
