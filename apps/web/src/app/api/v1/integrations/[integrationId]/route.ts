import { NextRequest, NextResponse } from "next/server";
import { GET as listIntegrations, POST as updateIntegration } from "../route";

const RETAINED_INTEGRATIONS = new Set([
  "website",
  "database",
  "web_search",
  "whatsapp",
  "calcom",
]);

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await context.params;
  if (!RETAINED_INTEGRATIONS.has(integrationId)) {
    return NextResponse.json({ success: false, error: "Integration not found" }, { status: 404 });
  }
  const response =
    (await listIntegrations(req)) ??
    NextResponse.json(
      { success: false, error: "Failed to load integrations" },
      { status: 500 },
    );
  const payload = (await response.json()) as {
    success: boolean;
    data?: { integrations?: Array<Record<string, unknown>> };
    error?: string;
  };
  if (!response.ok || !payload.success) {
    return NextResponse.json(payload, { status: response.status });
  }
  const integration = payload.data?.integrations?.find(
    (item) => item.id === integrationId,
  );
  if (!integration) {
    return NextResponse.json({ success: false, error: "Integration not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: { integration } });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ integrationId: string }> },
) {
  const { integrationId } = await context.params;
  if (!RETAINED_INTEGRATIONS.has(integrationId)) {
    return NextResponse.json({ success: false, error: "Integration not found" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    enabled?: boolean;
    config?: Record<string, unknown>;
  };
  const forwarded = new NextRequest(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({ ...body, integrationId }),
  });
  return updateIntegration(forwarded);
}
