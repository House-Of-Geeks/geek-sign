import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { teams, teamInvitations, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { plansConfig } from "@/config/plans";
import type { Plan } from "@/types";
import { APP_URL } from "@/lib/app-url";

const inviteSchema = z.object({
  email: z.string().email(),
});

// POST - Send team invitation
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check user's plan
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isSuperAdmin = user.isSuperAdmin ?? false;
    const effectivePlan = isSuperAdmin ? "team" : (user.plan || "free") as Plan;
    const planConfig = plansConfig[effectivePlan];

    if (planConfig.limits.teamMembers === 0) {
      return NextResponse.json(
        { error: "Team features require Team plan" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const { email } = parsed.data;
    const normalizedEmail = email.toLowerCase().trim();

    // Can't invite yourself
    if (normalizedEmail === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "You cannot invite yourself" },
        { status: 400 }
      );
    }

    // Get or create team for user
    let [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.ownerId, session.user.id))
      .limit(1);

    if (!team) {
      // Create team
      const [newTeam] = await db
        .insert(teams)
        .values({
          name: `${user.name || user.email}'s Team`,
          ownerId: session.user.id,
        })
        .returning();
      team = newTeam;
    }

    // Check if invitation already exists
    const [existingInvite] = await db
      .select()
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.teamId, team.id),
          eq(teamInvitations.email, normalizedEmail),
          eq(teamInvitations.status, "pending")
        )
      )
      .limit(1);

    if (existingInvite) {
      return NextResponse.json(
        { error: "An invitation has already been sent to this email" },
        { status: 400 }
      );
    }

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [invitation] = await db
      .insert(teamInvitations)
      .values({
        teamId: team.id,
        email: normalizedEmail,
        invitedBy: session.user.id,
        expiresAt,
      })
      .returning();

    // Send invitation email
    const inviteUrl = `${APP_URL}/invite/${invitation.token}`;
    const inviterName = user.name || user.email;

    await sendEmail({
      to: normalizedEmail,
      subject: `${inviterName} invited you to join their team on Geek Sign`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <tr>
                      <td style="background-color: #3b82f6; padding: 24px; text-align: center;">
                        <h1 style="margin: 0; color: #ffffff; font-size: 24px;">Geek Sign</h1>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 32px 24px;">
                        <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">
                          You're invited to join a team!
                        </h2>
                        <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
                          <strong>${inviterName}</strong> has invited you to join their team on Geek Sign.
                        </p>
                        <p style="margin: 0 0 24px 0; font-size: 15px; color: #374151; line-height: 1.6;">
                          As a team member, you'll be able to collaborate on documents and manage signatures together.
                        </p>
                        <div style="text-align: center;">
                          <a href="${inviteUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">
                            Accept Invitation
                          </a>
                        </div>
                        <p style="margin: 24px 0 0 0; font-size: 13px; color: #6b7280;">
                          This invitation expires in 7 days.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    return NextResponse.json({ success: true, invitation: { id: invitation.id } });
  } catch (error) {
    console.error("Error sending invitation:", error);
    return NextResponse.json(
      { error: "Failed to send invitation" },
      { status: 500 }
    );
  }
}

// GET - Get pending invitations for current user's team
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find team where user is owner
    const [team] = await db
      .select()
      .from(teams)
      .where(eq(teams.ownerId, session.user.id))
      .limit(1);

    if (!team) {
      return NextResponse.json({ invitations: [] });
    }

    // Get pending invitations
    const invitations = await db
      .select({
        id: teamInvitations.id,
        email: teamInvitations.email,
        status: teamInvitations.status,
        expiresAt: teamInvitations.expiresAt,
        createdAt: teamInvitations.createdAt,
      })
      .from(teamInvitations)
      .where(
        and(
          eq(teamInvitations.teamId, team.id),
          eq(teamInvitations.status, "pending")
        )
      );

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return NextResponse.json(
      { error: "Failed to fetch invitations" },
      { status: 500 }
    );
  }
}
