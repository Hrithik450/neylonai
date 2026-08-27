import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import { ApiAuthError, getOrganizationForUser } from "@neylonai/domain/billing";
import { seedWidgetContentFromKnowledge } from "@/server/widget-config";

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

/**
 * One-time AI seed of the widget's content (messages) from the org's crawled
 * knowledge. Fired from the onboarding wizard's "getting ready" step once the
 * initial crawl completes. Idempotent: the `contentInitialized` lock makes
 * repeat calls (and re-crawls) a no-op, and generation failure leaves the
 * static defaults untouched.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;
    const result = await seedWidgetContentFromKnowledge(
      gate.org.organizationId,
    );
    return NextResponse.json({ success: true, data: result });
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
          error instanceof Error
            ? error.message
            : "Failed to prepare widget content",
      },
      { status: 500 },
    );
  }
}
