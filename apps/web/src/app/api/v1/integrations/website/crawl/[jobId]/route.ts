import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  ApiAuthError,
  getOrganizationForUser,
} from "@neylonai/domain/billing";
import {
  cancelWebsiteCrawl,
  getWebsiteCrawlJob,
} from "@neylonai/domain/knowledge";

async function requireOrg(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const org = await getOrganizationForUser(session.id);
  if (!org) return { error: NextResponse.json({ success: false, error: "No organization" }, { status: 403 }) };
  return { org };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;
    const { jobId } = await context.params;
    const job = await getWebsiteCrawlJob({
      organizationId: gate.org.organizationId,
      jobId,
    });
    if (!job) {
      return NextResponse.json(
        { success: false, error: "Crawl job not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: { job } });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load crawl",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;
    const { jobId } = await context.params;
    const job = await cancelWebsiteCrawl({
      organizationId: gate.org.organizationId,
      jobId,
    });
    if (!job) {
      return NextResponse.json(
        { success: false, error: "Crawl job not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, data: { job } });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to cancel crawl",
      },
      { status: 400 },
    );
  }
}
