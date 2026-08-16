import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/server/auth-cookies";
import {
  assertCanEnableIntegration,
  getOrganizationForUser,
  getSubscriptionForOrg,
} from "@neylonai/domain/billing";
import {
  getImportIngestKind,
  getIntegrationManifest,
  isImportIntegration,
} from "@neylonai/integrations/catalog";
import {
  connectAndSyncWebsite,
  connectAndSyncDatabase,
  disconnectSyncedIntegration,
  deleteKnowledgeDocument,
  getKnowledgeSource,
  getSyncedKnowledgeSnapshot,
} from "@neylonai/domain/knowledge";
import { POSTGRES_READONLY_SETUP_SQL } from "@neylonai/integrations/database/constants";
import { SUPABASE_READONLY_SETUP_SQL } from "@neylonai/integrations/database/setup";
import { db, knowledgeDocuments } from "@neylonai/database";
import { and, eq } from "drizzle-orm";

const requireOrg = async (req: NextRequest) => {
  const session = await getSessionFromRequest(req);
  if (!session) return { error: NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 }) };
  const org = await getOrganizationForUser(session.id);
  if (!org) return { error: NextResponse.json({ success: false, error: "No organization" }, { status: 403 }) };
  return { org };
};

const err = (msg: string, status = 400) => NextResponse.json({ success: false, error: msg }, { status });

export async function POST(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    const plan = subscription?.plan ?? "free";
    const ctx = { organizationId: gate.org.organizationId, plan };

    const body = (await req.json().catch(() => ({}))) as {
      integrationId?: string;
      action?: string;
      url?: string;
      maxPages?: number;
      documentId?: string;
      connectionUrl?: string;
      provider?: string;
      deployment?: string;
    };

    const action = (body.action ?? "connect_website").trim();
    let integrationId = body.integrationId?.trim() ?? "";
    if (!integrationId && (action === "connect_website" || action === "refresh")) {
      integrationId = "website";
    }
    if (!integrationId) return err("integrationId is required");

    const manifest = getIntegrationManifest(integrationId);
    if (!manifest || manifest.dataMode !== "import") {
      return err("Only Import integrations use this endpoint.");
    }

    if (action === "disconnect") {
      const { deletedDocuments, reimportAvailableAt } = await disconnectSyncedIntegration({
        organizationId: gate.org.organizationId,
        integrationId,
      });
      return NextResponse.json({ success: true, data: { integrationId, deletedDocuments, reimportAvailableAt } });
    }

    if (action === "delete_document") {
      const documentId = body.documentId?.trim() ?? "";
      if (!documentId) return err("documentId is required");
      await deleteKnowledgeDocument(gate.org.organizationId, documentId);
      const snapshot = await getSyncedKnowledgeSnapshot(gate.org.organizationId, integrationId);
      return NextResponse.json({ success: true, data: { integrationId, documentId, snapshot } });
    }

    if (!isImportIntegration(integrationId)) {
      return err("This Import integration is not available yet.");
    }

    const ingestKind = getImportIngestKind(integrationId);

    if (ingestKind === "oauth") return err("OAuth Import is not configured on this deployment yet.");

    if (ingestKind === "scrape") {
      await assertCanEnableIntegration(ctx, integrationId);
      const result = await connectAndSyncWebsite({
        organizationId: gate.org.organizationId,
        url: body.url?.trim() || undefined,
        maxPages: body.maxPages,
        plan,
      });
      return NextResponse.json({
        success: true,
        data: {
          integrationId,
          dataMode: "import",
          ingestKind: "scrape",
          queued: true,
          jobId: result.jobId,
          title: result.title,
          pagesScraped: result.pagesScraped,
          chunksCreated: result.chunkCount,
          chunkCount: result.chunkCount,
        },
      });
    }

    if (ingestKind === "schema") {
      await assertCanEnableIntegration(ctx, integrationId);
      const connectionUrl = body.connectionUrl?.trim() ?? "";
      if (!connectionUrl) return err("connectionUrl is required");
      const result = await connectAndSyncDatabase({
        organizationId: gate.org.organizationId,
        connectionUrl,
        provider: body.provider?.trim() || "supabase",
        deployment: body.deployment?.trim() || "cloud",
      });
      const snapshot = await getSyncedKnowledgeSnapshot(gate.org.organizationId, integrationId);
      return NextResponse.json({
        success: true,
        data: {
          integrationId,
          dataMode: "import",
          ingestKind: "schema",
          tableCount: result.tableCount,
          host: result.host,
          chunksCreated: result.chunkCount,
          chunkCount: result.chunkCount,
          snapshot,
          setupSql: SUPABASE_READONLY_SETUP_SQL,
          genericSetupSql: POSTGRES_READONLY_SETUP_SQL,
        },
      });
    }

    return err("Unsupported Import action for this integration.");
  } catch (error) {
    return err(error instanceof Error ? error.message : "Sync failed");
  }
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const id = req.nextUrl.searchParams.get("documentId")?.trim() || req.nextUrl.searchParams.get("sourceId")?.trim();
    if (!id) return err("sourceId or documentId required");

    const [doc] = await db
      .select()
      .from(knowledgeDocuments)
      .where(and(eq(knowledgeDocuments.id, id), eq(knowledgeDocuments.organization_id, gate.org.organizationId)))
      .limit(1);

    if (doc) {
      const raw = typeof doc.raw_content === "string" && doc.raw_content.trim() ? doc.raw_content : null;
      if (raw) {
        const name = `${(doc.canonical_path || "document").replace(/[^\w.-]+/g, "_") || "document"}.txt`;
        return new NextResponse(raw, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${name}"`,
            "Cache-Control": "no-store",
          },
        });
      }
      return NextResponse.json({ success: false, error: "No stored document text" }, { status: 404 });
    }

    const source = await getKnowledgeSource(gate.org.organizationId, id);
    if (!source) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });

    if (source.sourceType === "website") {
      const [webDoc] = await db
        .select()
        .from(knowledgeDocuments)
        .where(and(eq(knowledgeDocuments.organization_id, gate.org.organizationId), eq(knowledgeDocuments.source_id, source.id)))
        .limit(1);
      const text = typeof webDoc?.raw_content === "string" ? webDoc.raw_content : "";
      if (!text) return NextResponse.json({ success: false, error: "No stored website text" }, { status: 404 });
      const name = `${(source.websiteUrl || "website").replace(/[^\w.-]+/g, "_")}.txt`;
      return new NextResponse(text, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return err("Download not available");
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Download failed" }, { status: 500 });
  }
}
