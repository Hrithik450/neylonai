import { NextRequest, NextResponse } from "next/server";
import {
  applyProviderWebhookEvent,
  createStripeProvider,
} from "@neylonai/domain/billing";
import { checkWebhookRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");

    const rateLimit = await checkWebhookRateLimit(clientIp);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": rateLimit.remaining.toString(),
            "X-RateLimit-Reset": rateLimit.resetAt.toISOString(),
          }
        },
      );
    }

    const rawBody = await req.text();
    const provider = createStripeProvider();
    const event = await provider.parseWebhook(req.headers, rawBody);
    if (!event) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const result = await applyProviderWebhookEvent(event);

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
