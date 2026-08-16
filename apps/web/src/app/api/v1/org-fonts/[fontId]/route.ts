import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import { getOrganizationForUser } from "@neylonai/domain/billing";
import { deleteOrgFont } from "@/server/org-fonts";

async function requireOrg(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const org = await getOrganizationForUser(session.id);
  if (!org) return { error: NextResponse.json({ success: false, error: "No organization" }, { status: 403 }) };
  return { session, org };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ fontId: string }> },
) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const { fontId } = await params;
    if (!fontId?.trim()) {
      return NextResponse.json(
        { success: false, error: "Invalid font id" },
        { status: 400 },
      );
    }

    const result = await deleteOrgFont({
      organizationId: gate.org.organizationId,
      fontId: fontId.trim(),
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Server error",
      },
      { status: 500 },
    );
  }
}
