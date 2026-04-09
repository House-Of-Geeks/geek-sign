import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { templates, users, teamMembers } from "@/lib/db/schema";
import { eq, desc, or, inArray } from "drizzle-orm";
import { put } from "@vercel/blob";
import { plansConfig } from "@/config/plans";
import type { Plan } from "@/types";

// GET all templates for the current user
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memberships = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, session.user.id));
    const teamIds = memberships.map((m) => m.teamId);

    const userTemplates = await db
      .select()
      .from(templates)
      .where(
        teamIds.length > 0
          ? or(
              eq(templates.userId, session.user.id),
              inArray(templates.teamId, teamIds)
            )
          : eq(templates.userId, session.user.id)
      )
      .orderBy(desc(templates.createdAt));

    return NextResponse.json(userTemplates);
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json(
      { error: "Failed to fetch templates" },
      { status: 500 }
    );
  }
}

// POST create a new template
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user's plan limit
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Super admins get team plan features
    const isSuperAdmin = user.isSuperAdmin ?? false;
    const effectivePlan = isSuperAdmin ? "team" : (user.plan || "free") as Plan;
    const planConfig = plansConfig[effectivePlan];
    const templateLimit = planConfig.limits.templates;

    // Count existing templates
    const existingTemplates = await db
      .select()
      .from(templates)
      .where(eq(templates.userId, session.user.id));

    if (templateLimit !== -1 && existingTemplates.length >= templateLimit) {
      return NextResponse.json(
        {
          error: "Template limit reached",
          message: `Your ${planConfig.name} allows ${templateLimit} template(s). Upgrade for unlimited templates.`,
        },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const file = formData.get("file") as File | null;
    const fieldsJson = formData.get("fields") as string | null;

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required" },
        { status: 400 }
      );
    }

    let fileUrl = null;
    if (file) {
      // Upload file to Vercel Blob
      const blob = await put(`templates/${session.user.id}/${file.name}`, file, {
        access: "public",
      });
      fileUrl = blob.url;
    }

    let fields = null;
    if (fieldsJson) {
      try {
        fields = JSON.parse(fieldsJson);
      } catch {
        return NextResponse.json(
          { error: "Invalid fields JSON" },
          { status: 400 }
        );
      }
    }

    const [membership] = await db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, session.user.id))
      .limit(1);

    const [newTemplate] = await db
      .insert(templates)
      .values({
        userId: session.user.id,
        teamId: membership?.teamId ?? null,
        name,
        description: description || null,
        fileUrl,
        fields,
      })
      .returning();

    return NextResponse.json(newTemplate, { status: 201 });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      { error: "Failed to create template" },
      { status: 500 }
    );
  }
}
