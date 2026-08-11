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
  ensurePdfIntegrationSource,
  extractPdfText,
  getKnowledgeSource,
  getSyncedKnowledgeSnapshot,
  ingestPdfTextForOrg,
} from "@neylonai/domain/knowledge";
import { POSTGRES_READONLY_SETUP_SQL } from "@neylonai/integrations/database/constants";
import { SUPABASE_READONLY_SETUP_SQL } from "@neylonai/integrations/database/setup";
import {
  db,
  knowledgeDocuments,
} from "@neylonai/database";
import { and, eq } from "drizzle-orm";
import {
  getKnowledgeFileObject,
  knowledgeFileStorageKey,
  MAX_KNOWLEDGE_FILE_BYTES,
  putKnowledgeFileObject,
  deleteKnowledgeFileObject,
} from "@/server/knowledge-source-storage";

async function requireOrg(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    return {
      error: NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }
  const org = await getOrganizationForUser(session.id);
  if (!org) {
    return {
      error: NextResponse.json(
        { success: false, error: "No organization" },
        { status: 403 },
      ),
    };
  }
  return { org };
}

/**
 * Import-mode: scrape (Website), upload (PDF), schema (Database).
 * Connect/Sync integrations must not use this route except database schema import.
 */
export async function POST(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const contentType = req.headers.get("content-type") ?? "";
    const subscription = await getSubscriptionForOrg(gate.org.organizationId);
    const plan = subscription?.plan ?? "free";
    const ctx = {
      organizationId: gate.org.organizationId,
      plan,
    };

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const action = String(form.get("action") ?? "upload_pdf");
      const integrationId = String(
        form.get("integrationId") ?? (action === "upload_pdf" ? "pdf" : ""),
      );
      const file = form.get("file");

      if (!isImportIntegration(integrationId)) {
        return NextResponse.json(
          { success: false, error: "This Import integration is not available." },
          { status: 400 },
        );
      }
      if (getImportIngestKind(integrationId) !== "upload") {
        return NextResponse.json(
          {
            success: false,
            error: "This integration does not support file upload.",
          },
          { status: 400 },
        );
      }
      if (!(file instanceof File)) {
        return NextResponse.json(
          { success: false, error: "PDF file is required." },
          { status: 400 },
        );
      }

      await assertCanEnableIntegration(ctx, integrationId);

      const bytes = Buffer.from(await file.arrayBuffer());
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_KNOWLEDGE_FILE_BYTES) {
        return NextResponse.json(
          {
            success: false,
            error: `PDF must be between 1 byte and ${MAX_KNOWLEDGE_FILE_BYTES / (1024 * 1024)} MB.`,
          },
          { status: 400 },
        );
      }

      const fileName = file.name?.trim() || "document.pdf";
      const text = await extractPdfText(bytes);
      if (!text.trim()) {
        return NextResponse.json(
          {
            success: false,
            error: "Could not extract text from this PDF.",
          },
          { status: 400 },
        );
      }

      const { sourceId } = await ensurePdfIntegrationSource({
        organizationId: gate.org.organizationId,
      });

      const key = knowledgeFileStorageKey(
        gate.org.organizationId,
        sourceId,
        fileName,
      );
      const stored = await putKnowledgeFileObject({
        key,
        bytes,
        contentType: file.type || "application/pdf",
      });

      const { chunkCount } = await ingestPdfTextForOrg({
        organizationId: gate.org.organizationId,
        sourceId,
        fileName,
        text,
        storageKey: stored.key,
      });

      const snapshot = await getSyncedKnowledgeSnapshot(
        gate.org.organizationId,
        integrationId,
      );

      return NextResponse.json({
        success: true,
        data: {
          action,
          integrationId,
          dataMode: "import",
          ingestKind: "upload",
          chunksCreated: chunkCount,
          chunkCount,
          snapshot,
        },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      integrationId?: string;
      action?: string;
      url?: string;
      documentId?: string;
      connectionUrl?: string;
      provider?: string;
      deployment?: string;
    };

    const action = (body.action ?? "connect_website").trim();
    let integrationId = body.integrationId?.trim() ?? "";
    if (
      !integrationId &&
      (action === "connect_website" || action === "refresh")
    ) {
      integrationId = "website";
    }
    if (!integrationId) {
      return NextResponse.json(
        { success: false, error: "integrationId is required" },
        { status: 400 },
      );
    }

    const manifest = getIntegrationManifest(integrationId);
    if (!manifest || manifest.dataMode !== "import") {
      return NextResponse.json(
        {
          success: false,
          error: "Only Import integrations use this endpoint.",
        },
        { status: 400 },
      );
    }

    if (action === "disconnect") {
      const { storageKeys } = await disconnectSyncedIntegration({
        organizationId: gate.org.organizationId,
        integrationId,
      });
      for (const key of storageKeys) {
        await deleteKnowledgeFileObject(key);
      }
      return NextResponse.json({ success: true, data: { integrationId } });
    }

    if (action === "delete_document") {
      const documentId = body.documentId?.trim() ?? "";
      if (!documentId) {
        return NextResponse.json(
          { success: false, error: "documentId is required" },
          { status: 400 },
        );
      }
      const { storageKey } = await deleteKnowledgeDocument(
        gate.org.organizationId,
        documentId,
      );
      if (storageKey) await deleteKnowledgeFileObject(storageKey);
      const snapshot = await getSyncedKnowledgeSnapshot(
        gate.org.organizationId,
        integrationId,
      );
      return NextResponse.json({
        success: true,
        data: { integrationId, documentId, snapshot },
      });
    }

    if (!isImportIntegration(integrationId)) {
      return NextResponse.json(
        {
          success: false,
          error: "This Import integration is not available yet.",
        },
        { status: 400 },
      );
    }

    const ingestKind = getImportIngestKind(integrationId);

    if (ingestKind === "oauth") {
      return NextResponse.json(
        {
          success: false,
          error: "OAuth Import is not configured on this deployment yet.",
        },
        { status: 400 },
      );
    }

    if (ingestKind === "scrape") {
      await assertCanEnableIntegration(ctx, integrationId);
      const result = await connectAndSyncWebsite({
        organizationId: gate.org.organizationId,
        url: body.url?.trim() || undefined,
      });
      const snapshot = await getSyncedKnowledgeSnapshot(
        gate.org.organizationId,
        integrationId,
      );
      return NextResponse.json({
        success: true,
        data: {
          integrationId,
          dataMode: "import",
          ingestKind: "scrape",
          title: result.title,
          pagesScraped: result.pagesScraped,
          chunksCreated: result.chunkCount,
          chunkCount: result.chunkCount,
          snapshot,
        },
      });
    }

    if (ingestKind === "schema") {
      await assertCanEnableIntegration(ctx, integrationId);
      const connectionUrl = body.connectionUrl?.trim() ?? "";
      if (!connectionUrl) {
        return NextResponse.json(
          { success: false, error: "connectionUrl is required" },
          { status: 400 },
        );
      }
      const result = await connectAndSyncDatabase({
        organizationId: gate.org.organizationId,
        connectionUrl,
        provider: body.provider?.trim() || "supabase",
        deployment: body.deployment?.trim() || "cloud",
      });
      const snapshot = await getSyncedKnowledgeSnapshot(
        gate.org.organizationId,
        integrationId,
      );
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

    return NextResponse.json(
      {
        success: false,
        error: "Unsupported Import action for this integration.",
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 400 },
    );
  }
}

/** Download by sourceId (website text) or documentId (PDF file). */
export async function GET(req: NextRequest) {
  try {
    const gate = await requireOrg(req);
    if ("error" in gate) return gate.error;

    const sourceId = req.nextUrl.searchParams.get("sourceId")?.trim();
    const documentId = req.nextUrl.searchParams.get("documentId")?.trim();
    const id = documentId || sourceId;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "sourceId or documentId required" },
        { status: 400 },
      );
    }

    // Prefer document download (PDF list uses document ids)
    const [doc] = await db
      .select()
      .from(knowledgeDocuments)
      .where(
        and(
          eq(knowledgeDocuments.id, id),
          eq(knowledgeDocuments.organization_id, gate.org.organizationId),
        ),
      )
      .limit(1);

    if (doc) {
      const storageKey = doc.storage_key?.trim() || null;
      const fileName = doc.name || "document.pdf";
      const raw =
        typeof doc.raw_content === "string" && doc.raw_content.trim()
          ? doc.raw_content
          : null;

      if (storageKey) {
        const local = await getKnowledgeFileObject(storageKey);
        const bytes = local?.bytes ?? null;
        if (!bytes) {
          return NextResponse.json(
            { success: false, error: "PDF missing from storage" },
            { status: 404 },
          );
        }
        return new NextResponse(new Uint8Array(bytes), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
            "Cache-Control": "no-store",
          },
        });
      }

      if (raw) {
        const name = `${(doc.name || "document").replace(/[^\w.-]+/g, "_")}.txt`;
        return new NextResponse(raw, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Disposition": `attachment; filename="${name}"`,
            "Cache-Control": "no-store",
          },
        });
      }
    }

    const source = await getKnowledgeSource(gate.org.organizationId, id);
    if (!source) {
      return NextResponse.json(
        { success: false, error: "Not found" },
        { status: 404 },
      );
    }

    if (source.sourceType === "website") {
      const [webDoc] = await db
        .select()
        .from(knowledgeDocuments)
        .where(
          and(
            eq(knowledgeDocuments.organization_id, gate.org.organizationId),
            eq(knowledgeDocuments.source_id, source.id),
          ),
        )
        .limit(1);
      const text =
        typeof webDoc?.raw_content === "string" ? webDoc.raw_content : "";
      if (!text) {
        return NextResponse.json(
          { success: false, error: "No stored website text" },
          { status: 404 },
        );
      }
      const name = `${(source.websiteUrl || "website").replace(/[^\w.-]+/g, "_")}.txt`;
      return new NextResponse(text, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${name}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(
      { success: false, error: "Download not available" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Download failed",
      },
      { status: 500 },
    );
  }
}
