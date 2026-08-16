import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  ApiAuthError,
  getOrganizationForUser,
  getSubscriptionForOrg,
} from "@neylonai/domain/billing";
import {
  getLatestWebsiteCrawl,
  getWebsiteCrawlEntitlements,
  startWebsiteCrawl,
} from "@neylonai/domain/knowledge";
import type { WebsiteCrawlJobMode } from "@neylonai/database";

async function requireOrg(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const org = await getOrganizationForUser(session.id);
  if (!org) return { error: NextResponse.json({ success: false, error: "No organization" }, { status: 403 }) };
  return { org };
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;
    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    const plan = subscription?.plan ?? "free";
    const [job, entitlements] = await Promise.all([
      getLatestWebsiteCrawl(gate.org.organizationId),
      getWebsiteCrawlEntitlements({
        organizationId: gate.org.organizationId,
        plan,
      }),
    ]);
    return NextResponse.json({
      success: true,
      data: { job, entitlements },
    });
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

export async function POST(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;
    const body = (await req.json().catch(() => ({}))) as {
      url?: string;
      maxPages?: number;
      mode?: WebsiteCrawlJobMode;
    };
    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    const job = await startWebsiteCrawl({
      organizationId: gate.org.organizationId,
      plan: subscription?.plan ?? "free",
      url: body.url,
      maxPages: body.maxPages,
      mode: body.mode,
    });
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
        error: error instanceof Error ? error.message : "Failed to start crawl",
      },
      { status: 400 },
    );
  }
}
