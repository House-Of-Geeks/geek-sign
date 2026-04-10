import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  companyName: z.string().max(100).optional(),
  brandingLogoUrl: z.string().url().max(500).optional().nullable(),
  brandingPrimaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  savedSignature: z.string().max(200).optional().nullable(),
  savedInitials: z.string().max(20).optional().nullable(),
  sendAsName: z.string().max(100).optional().nullable(),
});

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        plan: users.plan,
        companyName: users.companyName,
        brandingLogoUrl: users.brandingLogoUrl,
        brandingPrimaryColor: users.brandingPrimaryColor,
        savedSignature: users.savedSignature,
        savedInitials: users.savedInitials,
        sendAsName: users.sendAsName,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, companyName, brandingLogoUrl, brandingPrimaryColor, savedSignature, savedInitials, sendAsName } = parsed.data;

    // Build update object with only provided fields
    const updateData: {
      name?: string;
      companyName?: string;
      brandingLogoUrl?: string | null;
      brandingPrimaryColor?: string | null;
      savedSignature?: string | null;
      savedInitials?: string | null;
      sendAsName?: string | null;
    } = {};
    if (name !== undefined) updateData.name = name;
    if (companyName !== undefined) updateData.companyName = companyName;
    if (brandingLogoUrl !== undefined) updateData.brandingLogoUrl = brandingLogoUrl;
    if (brandingPrimaryColor !== undefined) updateData.brandingPrimaryColor = brandingPrimaryColor;
    if (savedSignature !== undefined) updateData.savedSignature = savedSignature;
    if (savedInitials !== undefined) updateData.savedInitials = savedInitials;
    if (sendAsName !== undefined) updateData.sendAsName = sendAsName;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 }
      );
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, session.user.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
