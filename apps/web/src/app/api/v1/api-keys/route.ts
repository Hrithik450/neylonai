import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  getOrganizationForUser,
  getSubscriptionForOrg,
  listApiKeysForOrg,
  regenerateApiKey,
  revokeApiKey,
  updateApiKeyOrigins,
  getPlanEntitlements,
} from "@neylonai/domain/billing";

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

    const [keys, subscription] = await Promise.all([
      listApiKeysForOrg(gate.org.organizationId),
      getSubscriptionForOrg(gate.org.organizationId),
    ]);

    const entitlements = getPlanEntitlements(subscription?.plan);

    return NextResponse.json({
      success: true,
      data: {
        organization: {
          id: gate.org.organizationId,
          slug: gate.org.slug,
          name: gate.org.name,
        },
        subscription: subscription
          ? {
              status: subscription.status,
              plan: subscription.plan,
              paymentProvider: subscription.payment_provider,
              currentPeriodEnd: subscription.current_period_end,
              monthlyRequestLimit: subscription.monthly_request_limit,
            }
          : null,
        entitlements,
        apiKeys: keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.keyPrefix,
          lastFour: k.lastFour,
          publicKey: k.publicKey ?? null,
          allowedOrigins: k.allowedOrigins ?? [],
          revoked: Boolean(k.revokedAt),
          lastUsedAt: k.lastUsedAt,
          createdAt: k.createdAt,
          display: `${k.keyPrefix}…${k.lastFour}`,
        })),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load keys",
      },
      { status: 500 },
    );
  }
}

/** Regenerate: revoke active keys and mint a new one (plaintext returned once). */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const body = (await req.json().catch(() => ({}))) as {
      name?: string;
      allowedOrigins?: string[];
    };
    const created = await regenerateApiKey(
      gate.org.organizationId,
      body.name?.trim() || "Default",
      Array.isArray(body.allowedOrigins) ? body.allowedOrigins : [],
    );

    return NextResponse.json({
      success: true,
      data: {
        id: created.id,
        prefix: created.prefix,
        lastFour: created.lastFour,
        apiKey: created.rawKey,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to regenerate key",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const body = (await req.json().catch(() => ({}))) as {
      apiKeyId?: string;
      allowedOrigins?: string[];
    };
    if (!body.apiKeyId || !Array.isArray(body.allowedOrigins)) {
      return NextResponse.json(
        { success: false, error: "apiKeyId and allowedOrigins required" },
        { status: 400 },
      );
    }

    const ok = await updateApiKeyOrigins(
      gate.org.organizationId,
      body.apiKeyId,
      body.allowedOrigins.map((o) => String(o).trim()).filter(Boolean),
    );
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Key not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update key",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const body = (await req.json().catch(() => ({}))) as { apiKeyId?: string };
    if (!body.apiKeyId) {
      return NextResponse.json(
        { success: false, error: "apiKeyId is required" },
        { status: 400 },
      );
    }

    const ok = await revokeApiKey(gate.org.organizationId, body.apiKeyId);
    if (!ok) {
      return NextResponse.json(
        { success: false, error: "Key not found or already revoked" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to revoke key",
      },
      { status: 500 },
    );
  }
}
