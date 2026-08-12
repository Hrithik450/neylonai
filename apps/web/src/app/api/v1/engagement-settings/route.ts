import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import { getOrganizationForUser } from "@neylonai/domain/billing";
import {
  getEngagementSettings,
  saveEngagementSettings,
  type EngagementSettings,
} from "@neylonai/domain/conversations";

async function requireOrg(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session)
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  const org = await getOrganizationForUser(session.id);
  if (!org)
    return {
      error: NextResponse.json(
        { success: false, error: "No organization" },
        { status: 403 },
      ),
    };
  return { org };
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const settings = await getEngagementSettings(gate.org.organizationId);
    return NextResponse.json({ success: true, data: { settings } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load engagement settings",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const body = (await req.json()) as Partial<
      Omit<EngagementSettings, "organizationId">
    >;

    const settings = await saveEngagementSettings(
      gate.org.organizationId,
      body,
    );
    return NextResponse.json({ success: true, data: { settings } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save engagement settings",
      },
      { status: 500 },
    );
  }
}
