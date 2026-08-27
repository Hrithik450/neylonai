import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  createApiKeyForOrg,
  getOrganizationForUser,
  listApiKeysForOrg,
  listOrgIntegrations,
  regenerateApiKey,
  registrableDomainFromUrl,
} from "@neylonai/domain/billing";

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
  return { session, org };
}

/**
 * Ensure the org has a copyable publishable key — the "mint on copy" endpoint
 * behind the Overview install card. Idempotent and NON-rotating:
 * - An active key with a retrievable `public_key` → return it as-is.
 * - An active key that predates `public_key` (null) → tell the client to rotate;
 *   we never silently rotate here, since that would break a snippet already
 *   deployed on the customer's site.
 * - No active key (the lazy default for a fresh org) → mint one now, seeding its
 *   allowed domain from the connected website's apex when the site is already
 *   connected, otherwise leaving it unrestricted until Integrations sets it.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;
    const organizationId = gate.org.organizationId;

    // Opt-in only: `rotateLegacy` swaps the safe default (report needsRotate)
    // for an in-place rotation of a legacy hash-only key.
    const body = (await req.json().catch(() => ({}))) as {
      rotateLegacy?: boolean;
    };

    const keys = await listApiKeysForOrg(organizationId);
    const active = keys
      .filter((k) => !k.revokedAt)
      .sort(
        (a, b) =>
          (b.createdAt ? new Date(b.createdAt).getTime() : 0) -
          (a.createdAt ? new Date(a.createdAt).getTime() : 0),
      )[0];

    if (active) {
      if (active.publicKey) {
        return NextResponse.json({
          success: true,
          data: { apiKey: active.publicKey, created: false, needsRotate: false },
        });
      }
      // Legacy key, hash-only. Its original plaintext was never stored, so it
      // can never become copyable — the only path to a copyable snippet is to
      // mint a fresh key. Do that ONLY on an explicit rotateLegacy request (the
      // "Rotate & copy" action), carrying over the old key's allowed domain. A
      // plain ensure still just reports needsRotate, so we never silently
      // replace a key that might already be live on a customer's site.
      if (body.rotateLegacy) {
        const rotated = await regenerateApiKey(
          organizationId,
          active.name || "Widget",
          active.allowedOrigins ?? [],
        );
        return NextResponse.json({
          success: true,
          data: { apiKey: rotated.rawKey, created: true, needsRotate: false },
        });
      }
      return NextResponse.json({
        success: true,
        data: { apiKey: null, created: false, needsRotate: true },
      });
    }

    // No key yet → mint. Bind the allowed domain to the connected website's
    // registrable apex if the site is already connected; else leave it open
    // (Integrations → Website sets it later, converging on the same apex).
    let allowedOrigins: string[] = [];
    try {
      const integrations = await listOrgIntegrations(organizationId);
      const website = integrations.find((i) => i.integration_id === "website");
      const url = (website?.config as Record<string, unknown> | null)?.url;
      const apex =
        typeof url === "string" ? registrableDomainFromUrl(url) : null;
      if (apex) allowedOrigins = [apex];
    } catch (error) {
      console.warn("[api-keys/ensure] domain derivation skipped:", error);
    }

    const created = await createApiKeyForOrg(
      organizationId,
      "Widget",
      allowedOrigins,
    );
    return NextResponse.json({
      success: true,
      data: { apiKey: created.rawKey, created: true, needsRotate: false },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to prepare API key",
      },
      { status: 500 },
    );
  }
}
