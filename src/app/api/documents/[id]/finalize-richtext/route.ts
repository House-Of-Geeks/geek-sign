import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, recipients, documentFields } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { documentAccessClause, getUserTeamIds } from "@/lib/db/team-access";
import { collectSigningFields, remapFieldRoles } from "@/lib/richtext/content-walk";
import { canUseRichtext } from "@/lib/features";

interface RoleInput {
  id: string;
  label: string;
  email: string;
  name?: string | null;
}

/**
 * Finalise a richtext draft document: create real recipient rows from the
 * draft `recipientRoles`, rewrite the content so inline fields point at the
 * new recipient ids, and create the per-field rows. After this the document
 * is ready for the standard "Send" flow.
 *
 * Idempotent guard: rejects if recipients already exist for this document.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await canUseRichtext(session.user.id))) {
      return NextResponse.json(
        { error: "On-platform composition is not enabled for this account" },
        { status: 403 }
      );
    }

    const teamIds = await getUserTeamIds(session.user.id);
    const [document] = await db
      .select()
      .from(documents)
      .where(documentAccessClause(params.id, session.user.id, teamIds))
      .limit(1);

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    if (document.contentType !== "richtext") {
      return NextResponse.json(
        { error: "This endpoint only handles richtext documents" },
        { status: 400 }
      );
    }

    if (document.status !== "draft") {
      return NextResponse.json(
        { error: "Document is no longer a draft" },
        { status: 400 }
      );
    }

    // Idempotency: bail if recipients already exist
    const existingRecipients = await db
      .select({ id: recipients.id })
      .from(recipients)
      .where(eq(recipients.documentId, document.id))
      .limit(1);
    if (existingRecipients.length > 0) {
      return NextResponse.json(
        { error: "Document already has recipients" },
        { status: 409 }
      );
    }

    const roles = (document.recipientRoles as RoleInput[] | null) ?? [];
    if (roles.length === 0) {
      return NextResponse.json(
        { error: "Add at least one signer before sending" },
        { status: 400 }
      );
    }

    const missingEmail = roles.find((r) => !r.email || !r.email.trim());
    if (missingEmail) {
      return NextResponse.json(
        { error: `Missing email for signer "${missingEmail.label}"` },
        { status: 400 }
      );
    }

    // Create recipient rows in role order
    const roleIdToRecipientId = new Map<string, string>();
    const createdRecipients: Array<{ id: string; email: string }> = [];
    for (let i = 0; i < roles.length; i++) {
      const role = roles[i];
      const [r] = await db
        .insert(recipients)
        .values({
          documentId: document.id,
          email: role.email.trim(),
          name: role.name?.trim() || role.label || null,
          orderIndex: i,
          status: "pending",
        })
        .returning();
      roleIdToRecipientId.set(role.id, r.id);
      createdRecipients.push({ id: r.id, email: r.email });
    }

    // Rewrite content so inline field nodes reference recipient ids
    const remappedContent = remapFieldRoles(document.content, roleIdToRecipientId);
    await db
      .update(documents)
      .set({ content: remappedContent, updatedAt: new Date() })
      .where(eq(documents.id, document.id));

    // Create one document_fields row per inline signingField
    const inlineFields = collectSigningFields(remappedContent);
    for (const f of inlineFields) {
      const recipientId =
        roleIdToRecipientId.get(f.recipientRoleId) ??
        (f.recipientRoleId || createdRecipients[0]?.id);
      if (!recipientId) continue;
      await db.insert(documentFields).values({
        documentId: document.id,
        recipientId,
        type: f.fieldType,
        fieldKey: f.fieldKey,
        required: f.required ?? true,
      });
    }

    return NextResponse.json({
      success: true,
      recipientCount: createdRecipients.length,
      fieldCount: inlineFields.length,
    });
  } catch (error) {
    console.error("Finalize richtext error:", error);
    return NextResponse.json(
      { error: "Failed to finalise document" },
      { status: 500 }
    );
  }
}
