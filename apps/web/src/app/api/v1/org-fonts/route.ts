import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import { getOrganizationForUser } from "@neylonai/domain/billing";
import {
  listOrgFonts,
  ORG_FONT_MAX_COUNT,
  uploadOrgFont,
} from "@/server/org-fonts";

const requireOrg = async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const org = await getOrganizationForUser(session.id);
  if (!org) return { error: NextResponse.json({ success: false, error: "No organization" }, { status: 403 }) };
  return { session, org };
};

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const fonts = await listOrgFonts(gate.org.organizationId);
    return NextResponse.json({ success: true, data: { fonts, max: ORG_FONT_MAX_COUNT } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const form = await req.formData();
    const file = form.get("file");
    const familyNameRaw = form.get("familyName");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "file is required" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const result = await uploadOrgFont({
      organizationId: gate.org.organizationId,
      filename: file.name || "font.woff2",
      bytes,
      familyName: typeof familyNameRaw === "string" ? familyNameRaw : undefined,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Server error" }, { status: 500 });
  }
}
