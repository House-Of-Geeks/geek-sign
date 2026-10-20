import { and, desc, eq, inArray, or } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { documentFields, documents, recipients, teamMembers, templates } from "@/lib/db/schema";
import { getUserTeamIds } from "@/lib/db/team-access";
import { collectSigningFields, remapFieldRoles, substituteVariables } from "@/lib/richtext/content-walk";
import { fail, ok, type Actor, type ServiceResult } from "./result";

type TemplateRow = typeof templates.$inferSelect;
type DocumentRow = typeof documents.$inferSelect;

interface TemplateField {
  id?: string;
  label?: string;
  type: string;
  page: number;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  required?: boolean;
  recipientIndex?: number;
}

/** Templates the user owns or shares through a team, newest first. */
export async function listAccessibleTemplates(userId: string): Promise<TemplateRow[]> {
  const teamIds = await getUserTeamIds(userId);

  return db
    .select()
    .from(templates)
    .where(
      teamIds.length > 0
        ? or(eq(templates.userId, userId), inArray(templates.teamId, teamIds))
        : eq(templates.userId, userId),
    )
    .orderBy(desc(templates.createdAt));
}

/** The template if the user owns it or shares a team with it. */
export async function findAccessibleTemplate(
  templateId: string,
  userId: string,
  knownTeamIds?: string[],
): Promise<TemplateRow | undefined> {
  const teamIds = knownTeamIds ?? (await getUserTeamIds(userId));
  const [template] = await db
    .select()
    .from(templates)
    .where(
      and(
        eq(templates.id, templateId),
        teamIds.length > 0
          ? or(eq(templates.userId, userId), inArray(templates.teamId, teamIds))
          : eq(templates.userId, userId),
      ),
    )
    .limit(1);
  return template;
}

/** Loosely typed on purpose: session callers pass the request body as is and it is validated here. */
export interface TemplateUseInput {
  title?: string;
  recipientEmails?: unknown;
  customMessage?: string | null;
  senderFieldValues?: Record<string, string>;
  senderUserId?: string;
  senderDisplayName?: string | null;
  variables?: Record<string, string> | null;
}

export async function createDocumentFromTemplate(
  templateId: string,
  actor: Actor,
  input: TemplateUseInput,
): Promise<
  ServiceResult<{
    document: DocumentRow;
    recipients: Array<{ id: string; email: string; orderIndex: number }>;
    message: string;
  }>
> {
  // Get the template (own or team)
  const teamIds = await getUserTeamIds(actor.userId);
  const template = await findAccessibleTemplate(templateId, actor.userId, teamIds);

  if (!template) return fail(404, "Template not found");

  const { title, recipientEmails, customMessage, senderFieldValues, senderUserId, senderDisplayName, variables } =
    input;

  if (!title) {
    return fail(400, "Document title is required");
  }

  if (!recipientEmails || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
    return fail(400, "At least one recipient email is required");
  }

  const isRichtext = template.contentType === "richtext";

  let fileUrl: string | null = template.fileUrl ?? null;
  let fileName: string | null = template.name + ".pdf";

  if (isRichtext) {
    fileUrl = null;
    fileName = null;
  } else if (template.fileUrl) {
    // Fetch the template file and re-upload to create a copy
    const response = await fetch(template.fileUrl);
    if (response.ok) {
      const blob = await response.blob();
      const uploadResult = await put(`documents/${actor.userId}/${Date.now()}-${fileName}`, blob, {
        access: "public",
      });
      fileUrl = uploadResult.url;
    }
  } else {
    return fail(400, "Template has no associated file");
  }

  // Validate senderUserId is a team member if provided.
  // When delegating, also attach the document to a shared team so the
  // acting user retains access via the team-access clause.
  let documentUserId = actor.userId;
  let documentTeamId: string | null = null;
  if (senderUserId && senderUserId !== actor.userId) {
    const senderMembership = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(and(eq(teamMembers.userId, senderUserId), inArray(teamMembers.teamId, teamIds)))
      .limit(1);
    if (senderMembership.length > 0) {
      documentUserId = senderUserId;
      documentTeamId =
        template.teamId && teamIds.includes(template.teamId) ? template.teamId : senderMembership[0].teamId;
    }
  }

  // For richtext: substitute variable nodes with their provided values
  // (the role remap below requires recipients to exist, so we do it after).
  let documentContent: unknown = null;
  if (isRichtext) {
    const variableMap = (variables ?? {}) as Record<string, string>;
    documentContent = substituteVariables(template.content, variableMap);
  }

  // Create the document
  const [newDocument] = await db
    .insert(documents)
    .values({
      userId: documentUserId,
      teamId: documentTeamId,
      title,
      contentType: isRichtext ? "richtext" : "pdf",
      content: documentContent,
      variables: isRichtext ? (variables ?? null) : null,
      fileUrl: fileUrl,
      fileName: fileName,
      status: "draft",
      customMessage: customMessage || null,
      senderDisplayName: senderDisplayName || null,
    })
    .returning();

  // Create recipients
  const createdRecipients: Array<{ id: string; email: string; orderIndex: number }> = [];
  for (let i = 0; i < recipientEmails.length; i++) {
    const email = recipientEmails[i];
    const [recipient] = await db
      .insert(recipients)
      .values({
        documentId: newDocument.id,
        email: typeof email === "string" ? email : email.email,
        name: typeof email === "object" ? email.name : null,
        orderIndex: i,
        status: "pending",
      })
      .returning();

    createdRecipients.push({
      id: recipient.id,
      email: recipient.email,
      orderIndex: i,
    });
  }

  if (isRichtext) {
    // Map template role UUIDs -> recipient indexes -> recipient DB ids.
    const roles = (template.recipientRoles as Array<{ id: string }> | null) ?? [];
    const roleIdToRecipientId = new Map<string, string>();
    roles.forEach((r, i) => {
      const recipient = createdRecipients[i] || createdRecipients[0];
      if (recipient) roleIdToRecipientId.set(r.id, recipient.id);
    });

    // Rewrite signingField nodes so recipientRoleId now references the
    // document's recipient UUID (not the template role UUID).
    documentContent = remapFieldRoles(documentContent, roleIdToRecipientId);

    // Now persist a document_fields row per inline signingField.
    const inlineFields = collectSigningFields(documentContent);
    for (const f of inlineFields) {
      const recipientId =
        roleIdToRecipientId.get(f.recipientRoleId) ?? (f.recipientRoleId || createdRecipients[0]?.id);
      if (!recipientId) continue;
      await db.insert(documentFields).values({
        documentId: newDocument.id,
        recipientId,
        type: f.fieldType,
        fieldKey: f.fieldKey,
        required: f.required ?? true,
      });
    }

    // Persist the remapped content
    await db.update(documents).set({ content: documentContent }).where(eq(documents.id, newDocument.id));
  } else if (template.fields && Array.isArray(template.fields)) {
    const templateFields = template.fields as TemplateField[];

    for (const field of templateFields) {
      const recipientIndex = field.recipientIndex ?? 0;

      if (recipientIndex === -1) {
        // Sender-fill field: assign to recipient 0 with the sender's pre-filled value
        const recipient = createdRecipients[0];
        if (recipient) {
          const fieldId = field.id || "";
          const value = senderFieldValues?.[fieldId] || null;
          await db.insert(documentFields).values({
            documentId: newDocument.id,
            recipientId: recipient.id,
            type: "sender_paragraph",
            page: field.page || 1,
            xPosition: field.xPosition,
            yPosition: field.yPosition,
            width: field.width,
            height: field.height,
            required: false,
            value,
          });
        }
      } else {
        // Normal recipient field
        const recipient = createdRecipients[recipientIndex] || createdRecipients[0];
        if (recipient) {
          await db.insert(documentFields).values({
            documentId: newDocument.id,
            recipientId: recipient.id,
            type: field.type,
            page: field.page || 1,
            xPosition: field.xPosition,
            yPosition: field.yPosition,
            width: field.width,
            height: field.height,
            required: field.required ?? true,
          });
        }
      }
    }
  }

  return ok({
    document: newDocument,
    recipients: createdRecipients,
    message: "Document created from template successfully",
  });
}
