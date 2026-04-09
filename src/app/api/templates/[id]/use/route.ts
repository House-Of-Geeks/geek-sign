import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templates, documents, recipients, documentFields, teamMembers } from "@/lib/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { put } from "@vercel/blob";

async function getTeamIds(userId: string): Promise<string[]> {
  const memberships = await db
    .select({ teamId: teamMembers.teamId })
    .from(teamMembers)
    .where(eq(teamMembers.userId, userId));
  return memberships.map((m) => m.teamId);
}

interface TemplateField {
  type: string;
  page: number;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  required?: boolean;
  recipientIndex?: number;
}

// POST use template to create a new document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the template (own or team)
    const teamIds = await getTeamIds(session.user.id);
    const [template] = await db
      .select()
      .from(templates)
      .where(
        and(
          eq(templates.id, id),
          teamIds.length > 0
            ? or(eq(templates.userId, session.user.id), inArray(templates.teamId, teamIds))
            : eq(templates.userId, session.user.id)
        )
      )
      .limit(1);

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const body = await request.json();
    const { title, recipientEmails, customMessage } = body;

    if (!title) {
      return NextResponse.json(
        { error: "Document title is required" },
        { status: 400 }
      );
    }

    if (!recipientEmails || !Array.isArray(recipientEmails) || recipientEmails.length === 0) {
      return NextResponse.json(
        { error: "At least one recipient email is required" },
        { status: 400 }
      );
    }

    // If template has a file, copy it for the new document
    let fileUrl = template.fileUrl;
    let fileName = template.name + ".pdf";

    if (template.fileUrl) {
      // Fetch the template file and re-upload to create a copy
      const response = await fetch(template.fileUrl);
      if (response.ok) {
        const blob = await response.blob();
        const uploadResult = await put(
          `documents/${session.user.id}/${Date.now()}-${fileName}`,
          blob,
          { access: "public" }
        );
        fileUrl = uploadResult.url;
      }
    } else {
      return NextResponse.json(
        { error: "Template has no associated file" },
        { status: 400 }
      );
    }

    // Create the document
    const [newDocument] = await db
      .insert(documents)
      .values({
        userId: session.user.id,
        title,
        fileUrl: fileUrl!,
        fileName,
        status: "draft",
        customMessage: customMessage || null,
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

    // Copy template fields to document fields
    if (template.fields && Array.isArray(template.fields)) {
      const templateFields = template.fields as TemplateField[];

      for (const field of templateFields) {
        // Determine which recipient this field belongs to
        const recipientIndex = field.recipientIndex ?? 0;
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

    return NextResponse.json({
      document: newDocument,
      recipients: createdRecipients,
      message: "Document created from template successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("Error using template:", error);
    return NextResponse.json(
      { error: "Failed to create document from template" },
      { status: 500 }
    );
  }
}
