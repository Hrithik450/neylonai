import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import { getOrganizationForUser } from "@neylonai/domain/billing";
import { listOrgLeads } from "@neylonai/agent";

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

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const rows = await listOrgLeads(gate.org.organizationId);
    const leads = rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      company: row.company,
      status: row.status ?? "new",
      sourceConversationId: row.thread_id,
      sourceAgentId: row.source_agent_id,
      sourceAgentName: row.source_agent_id,
      crmSyncStatus: row.crm_sync_status ?? "not_connected",
      created_at: row.created_at ?? new Date().toISOString(),
    }));

    return NextResponse.json({ success: true, data: { leads } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load leads",
      },
      { status: 500 },
    );
  }
}
