import { NextResponse } from "next/server";
import { presentTemplate } from "@/lib/assistant";
import { assistantErrorResponse, requireAssistant } from "@/lib/assistantAccess";
import { listAccessibleTemplates } from "@/lib/services/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user } = await requireAssistant(request);
    const templates = await listAccessibleTemplates(user.id);
    return NextResponse.json({ templates: templates.map(presentTemplate) });
  } catch (error) {
    return assistantErrorResponse(error);
  }
}
