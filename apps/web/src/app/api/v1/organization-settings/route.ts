import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import { getOrganizationForUser } from "@neylonai/domain/billing";
import {
  getOrganizationSettings,
  saveOrganizationSettings,
  type OrganizationSettingsPatch,
} from "@neylonai/domain/workspace";

async function requireOrg(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const org = await getOrganizationForUser(session.id);
  if (!org) return { error: NextResponse.json({ success: false, error: "No organization" }, { status: 403 }) };
  return { session, org };
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const settings = await getOrganizationSettings(gate.org.organizationId);
    return NextResponse.json({
      success: true,
      data: {
        settings,
        account: {
          userName: gate.session.name,
          userEmail: gate.session.email,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load organization settings",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const body = (await req.json()) as OrganizationSettingsPatch;
    const result = await saveOrganizationSettings(
      gate.org.organizationId,
      body,
    );

    return NextResponse.json({
      success: true,
      data: { settings: result.settings },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to save organization settings",
      },
      { status: 500 },
    );
  }
}
