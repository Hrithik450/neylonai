import { NextRequest, NextResponse } from "next/server";
import {
  applyProviderWebhookEvent,
  createStripeProvider,
} from "@neylonai/domain/billing";
import { trackEventlySafe } from "@neylonai/integrations/evently";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const provider = createStripeProvider();
    const event = await provider.parseWebhook(req.headers, rawBody);
    if (!event) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const result = await applyProviderWebhookEvent(event);
    if (result.organizationId) {
      const analyticsEvent =
        event.type === "subscription_cancelled"
          ? "subscription_cancelled"
          : event.type === "checkout_completed"
            ? "subscription_started"
            : "subscription_upgraded";
      trackEventlySafe({
        event: analyticsEvent,
        organizationId: result.organizationId,
        properties: {
          provider: "stripe",
          planId: event.planId ?? null,
          status: event.status ?? null,
        },
      });
    }

    return NextResponse.json({ received: true, ok: result.ok });
  } catch (error) {
    console.error("[stripe webhook]", error);
    const message =
      error instanceof Error ? error.message : "Webhook failed";
    const isClientError =
      /signature|invalid|malformed|missing/i.test(message);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: isClientError ? 400 : 500 },
    );
  }
}
