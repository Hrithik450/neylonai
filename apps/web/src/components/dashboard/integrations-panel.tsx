"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  INTEGRATION_DATA_MODE_LABELS,
  integrationLogoLetters,
  type IntegrationDataMode,
  type IntegrationUiState,
} from "@neylonai/integrations/catalog";
import { UpgradePrompt } from "@/components/dashboard/upgrade-prompt";
import { DatabaseConnectPanel } from "@/components/dashboard/integrations/database-connect-panel";
import { cn } from "@/lib/utils";

type UpgradePromptData = {
  title: string;
  detail: string;
  ctaLabel: string;
  href: string;
};

type KnowledgeSnapshot = {
  sourceCount: number;
  documentCount: number;
  chunkCount: number;
  url?: string | null;
  sources: Array<{
    id: string;
    name: string;
    type?: string;
    kind?: string;
    originUri: string | null;
    hasStoredFile: boolean;
    documentCount?: number;
    updatedAt: string;
  }>;
};

type IntegrationRow = {
  id: string;
  name: string;
  description: string;
  dataMode: IntegrationDataMode;
  connectable: boolean;
  implemented: boolean;
  ingestKind: "scrape" | "upload" | "oauth" | "schema" | null;
  planBadge: "free" | "starter" | "pro" | "business";
  logoUrl: string | null;
  stubNote: string | null;
  available: boolean;
  enabled: boolean;
  installed?: boolean;
  uiState: IntegrationUiState;
  /** Non-secret metadata only (credentials never returned from API). */
  config: Record<string, unknown>;
  /** True when vault (or legacy) holds credentials for this integration. */
  credentialsConfigured?: boolean;
  connectedAccount: string | null;
  lastSyncAt: string | null;
  knowledge: KnowledgeSnapshot | null;
};

function IntegrationLogo({
  name,
  logoUrl,
  className,
}: {
  name: string;
  logoUrl: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="" className={cn("object-contain", className)} />
    );
  }
  return (
    <span
      className={cn(
        "flex items-center justify-center font-semibold",
        className,
      )}
    >
      {integrationLogoLetters(name)}
    </span>
  );
}

function StatusPill({ state }: { state: IntegrationUiState }) {
  const map: Record<IntegrationUiState, { label: string; className: string }> =
    {
      connected: {
        label: "Connected",
        className: "bg-[var(--green)]/15 text-[var(--ink)]",
      },
      needs_attention: {
        label: "Needs attention",
        className: "bg-[var(--orange)]/20 text-[var(--ink)]",
      },
      disconnected: {
        label: "Disconnected",
        className: "bg-[var(--cream)] text-[var(--ink)]/70",
      },
      available: {
        label: "Available",
        className:
          "bg-white text-[var(--ink)]/70 border border-[var(--ink)]/15",
      },
      locked: {
        label: "Upgrade",
        className: "bg-[var(--cream)] text-[var(--ink)]/55",
      },
      coming_soon: {
        label: "Coming soon",
        className: "bg-[var(--cream)] text-[var(--ink)]/50",
      },
    };
  const m = map[state];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-medium",
        m.className,
      )}
    >
      {m.label}
    </span>
  );
}

function DataModeBadge({ mode }: { mode: IntegrationDataMode }) {
  return (
    <span className="caption text-[0.65rem] uppercase tracking-wide">
      {INTEGRATION_DATA_MODE_LABELS[mode]}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[var(--ink)]/55">
      {children}
    </h2>
  );
}

/**
 * Static progress copy for website scrape → ingest.
 * Guessed wall time for a typical public page is ~10–15s
 * (fetch + extract + chunk + Gemini embed). Steps advance every 2.5s
 * so each line is readable without feeling stuck.
 */
const WEBSITE_SYNC_STEPS = [
  "Scraping full page content…",
  "Following site links…",
  "Removing catalog / DB-backed noise…",
  "Creating knowledge documents…",
  "Generating embeddings…",
] as const;
const WEBSITE_SYNC_STEP_MS = 2800;

function WebsiteSyncProgress({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    setStep(0);
    const id = window.setInterval(() => {
      setStep((i) => (i + 1) % WEBSITE_SYNC_STEPS.length);
    }, WEBSITE_SYNC_STEP_MS);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div
      className="rounded-lg border border-[var(--ink)]/15 bg-[var(--cream)] px-3 py-2.5 space-y-1"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <span
          className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[var(--ink)]/25 border-t-[var(--ink)] animate-spin"
          aria-hidden
        />
        {WEBSITE_SYNC_STEPS[step]}
      </div>
      <p className="caption text-[0.65rem]">
        Multi-page sync usually takes 30–90 seconds (AI filters product
        catalogs).
      </p>
    </div>
  );
}

export function IntegrationsPanel() {
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<UpgradePromptData | null>(
    null,
  );
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [connectionUrl, setConnectionUrl] = useState("");
  const [websiteSyncing, setWebsiteSyncing] = useState(false);
  const [websiteError, setWebsiteError] = useState<string | null>(null);
  const [websiteSuccess, setWebsiteSuccess] = useState<string | null>(null);
  const [dbBusy, setDbBusy] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [dbSuccess, setDbSuccess] = useState<string | null>(null);

  const load = useCallback(async (opts?: { clearMessage?: boolean }) => {
    setLoading(true);
    if (opts?.clearMessage !== false) setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations");
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(
          `Integrations API failed (${res.status}). Refresh and try again.`,
        );
      }
      const json = (await res.json()) as {
        success: boolean;
        data?: {
          plan: string;
          integrations: IntegrationRow[];
          upgradePrompt: UpgradePromptData | null;
        };
        error?: string;
      };
      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Failed to load");
      }
      setRows(json.data.integrations);
      setUpgradePrompt(json.data.upgradePrompt);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setWebsiteError(null);
    setWebsiteSuccess(null);
    setDbError(null);
    setDbSuccess(null);
    setConnectionUrl("");
    setBookingUrl("");
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || websiteSyncing) return;
    const row = rows.find((r) => r.id === selectedId);
    if (!row) return;
    if (row.ingestKind === "scrape") {
      const url =
        (typeof row.config.url === "string" && row.config.url) ||
        row.knowledge?.url ||
        row.knowledge?.sources[0]?.originUri ||
        "";
      if (url) setWebsiteUrl(url);
    }
    if (row.ingestKind === "upload") setPdfFile(null);
    if (row.id === "calendly") {
      const url =
        (typeof row.config.bookingUrl === "string" && row.config.bookingUrl) ||
        (typeof row.config.url === "string" && row.config.url) ||
        "";
      setBookingUrl(url);
    }
  }, [selectedId, rows, websiteSyncing]);

  const setEnabled = async (
    integrationId: string,
    enabled: boolean,
    config?: Record<string, unknown>,
  ) => {
    setBusyId(integrationId);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId,
          enabled,
          ...(config ? { config } : {}),
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        upgradePrompt?: UpgradePromptData | null;
      };
      if (!json.success) {
        if (json.upgradePrompt) setUpgradePrompt(json.upgradePrompt);
        throw new Error(json.error ?? "Update failed");
      }
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  const uploadPdf = async (integrationId: string) => {
    if (!pdfFile) {
      setMessage("Choose a PDF file first.");
      return;
    }
    setBusyId(integrationId);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("action", "upload_pdf");
      fd.set("integrationId", integrationId);
      fd.set("file", pdfFile);
      const res = await fetch("/api/v1/integrations/knowledge", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { chunksCreated?: number };
      };
      if (!json.success) throw new Error(json.error ?? "Upload failed");
      setPdfFile(null);
      await load();
      setMessage(`PDF ingested (${json.data?.chunksCreated ?? 0} chunks).`);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusyId(null);
    }
  };

  const disconnectSynced = async (integrationId: string) => {
    setBusyId(integrationId);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect", integrationId }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Disconnect failed");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setBusyId(null);
    }
  };

  const deleteDocument = async (integrationId: string, documentId: string) => {
    setBusyId(integrationId);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/integrations/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_document",
          integrationId,
          documentId,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Delete failed");
      await load();
      setMessage("Document removed.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  const syncWebsite = async (
    integrationId: string,
    mode: "sync" | "refresh",
  ) => {
    const url = websiteUrl.trim();
    if (mode === "sync" && !url) {
      setWebsiteError("Enter a public website URL to sync.");
      setWebsiteSuccess(null);
      return;
    }

    setBusyId(integrationId);
    setWebsiteSyncing(true);
    setWebsiteError(null);
    setWebsiteSuccess(null);
    setMessage(null);

    try {
      const res = await fetch("/api/v1/integrations/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode === "refresh" ? "refresh" : "connect_website",
          integrationId,
          url: url || undefined,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { pagesScraped?: number; chunksCreated?: number };
      };
      if (!json.success) {
        throw new Error(json.error ?? "Sync failed");
      }
      await load({ clearMessage: false });
      setWebsiteSuccess(
        json.data
          ? `Synced ${json.data.pagesScraped ?? 0} page(s), ${json.data.chunksCreated ?? 0} chunks.`
          : "Website synced.",
      );
    } catch (e) {
      setWebsiteError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setWebsiteSyncing(false);
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const connected = useMemo(
    () =>
      filtered.filter(
        (r) => r.uiState === "connected" || r.uiState === "needs_attention",
      ),
    [filtered],
  );

  const available = useMemo(
    () =>
      filtered.filter(
        (r) =>
          r.uiState === "available" ||
          r.uiState === "disconnected" ||
          r.uiState === "locked" ||
          r.uiState === "coming_soon",
      ),
    [filtered],
  );

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  const connectDatabase = async (integrationId: string) => {
    if (!connectionUrl.trim()) {
      setDbError("Paste your Postgres connection URL first.");
      return;
    }
    setDbBusy(true);
    setDbError(null);
    setDbSuccess(null);
    setBusyId(integrationId);
    try {
      const res = await fetch("/api/v1/integrations/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          integrationId,
          action: "connect_database",
          connectionUrl: connectionUrl.trim(),
          provider: "supabase",
          deployment: "cloud",
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { tableCount?: number; host?: string; chunkCount?: number };
      };
      if (!json.success)
        throw new Error(json.error ?? "Database connect failed");
      setConnectionUrl("");
      await load();
      setDbSuccess(
        `Schema imported from ${json.data?.host ?? "Postgres"} (${json.data?.tableCount ?? 0} tables, ${json.data?.chunkCount ?? 0} chunks).`,
      );
    } catch (e) {
      setDbError(e instanceof Error ? e.message : "Database connect failed");
    } finally {
      setDbBusy(false);
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5 relative">
      <header className="space-y-1 max-w-3xl">
        <h1 className="text-3xl sm:text-4xl">Integrations</h1>
        <p className="caption text-sm">
          Connect external systems via Import, Connect, or Sync.
        </p>
      </header>

      {upgradePrompt ? (
        <UpgradePrompt
          compact
          title={upgradePrompt.title}
          detail={upgradePrompt.detail}
          ctaLabel={upgradePrompt.ctaLabel}
          href={upgradePrompt.href}
        />
      ) : null}

      <input
        id="integration-search"
        className="ink-input py-2 text-sm max-w-md w-full"
        placeholder="Search integrations…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search integrations"
      />

      {loading ? (
        <p className="caption text-sm">Loading integrations…</p>
      ) : filtered.length === 0 ? (
        <p className="caption text-sm">No integrations match.</p>
      ) : (
        <>
          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <SectionLabel>Connected</SectionLabel>
              <span className="caption text-[0.65rem]">
                {connected.length} active
              </span>
            </div>
            {connected.length === 0 ? (
              <p className="caption text-sm py-1">
                Nothing connected yet add Website or PDF below, or a live
                connector when available.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {connected.map((item) => (
                  <IntegrationCard
                    key={item.id}
                    item={item}
                    busy={busyId === item.id}
                    onOpen={() => setSelectedId(item.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <SectionLabel>Catalog</SectionLabel>
              <span className="caption text-[0.65rem]">
                {available.length} listed
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {available.map((item) => (
                <IntegrationCard
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onOpen={() => setSelectedId(item.id)}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {message ? (
        <p className="caption text-sm" role="status">
          {message}
        </p>
      ) : null}

      {selected ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[var(--ink)]/25 border-0 cursor-default"
            aria-label="Close integration detail"
            onClick={() => setSelectedId(null)}
          />
          <aside
            className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-white border-l border-[var(--ink)] shadow-xl overflow-y-auto p-5 space-y-4"
            role="dialog"
            aria-labelledby="integration-detail-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-[var(--ink)]/20 text-xs">
                    <IntegrationLogo
                      name={selected.name}
                      logoUrl={selected.logoUrl}
                      className="h-full w-full text-xs"
                    />
                  </span>
                  <div>
                    <h2
                      id="integration-detail-title"
                      className="text-lg font-semibold"
                    >
                      {selected.name}
                    </h2>
                    <DataModeBadge mode={selected.dataMode} />
                  </div>
                </div>
                <StatusPill state={selected.uiState} />
              </div>
              <button
                type="button"
                className="btn-ink bg-white text-sm px-3 py-1.5"
                onClick={() => setSelectedId(null)}
              >
                Close
              </button>
            </div>

            <p className="caption text-sm">{selected.description}</p>

            {selected.stubNote ? (
              <p className="text-sm rounded-lg border border-[var(--ink)]/15 bg-[var(--cream)] px-3 py-2">
                {selected.stubNote}
              </p>
            ) : null}

            {selected.dataMode === "import" &&
            selected.implemented &&
            selected.ingestKind === "scrape" ? (
              <div className="space-y-3 border-t border-[var(--ink)]/10 pt-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Website URL</span>
                  <input
                    className="ink-input w-full text-sm"
                    placeholder="https://example.com"
                    value={websiteUrl}
                    onChange={(e) => {
                      setWebsiteUrl(e.target.value);
                      setWebsiteError(null);
                      setWebsiteSuccess(null);
                    }}
                    disabled={websiteSyncing}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-ink bg-[var(--ink)] text-white text-sm px-4 py-2"
                    disabled={websiteSyncing || !websiteUrl.trim()}
                    onClick={() => void syncWebsite(selected.id, "sync")}
                  >
                    Sync
                  </button>
                  <button
                    type="button"
                    className="btn-ink bg-white text-sm px-4 py-2"
                    disabled={
                      websiteSyncing ||
                      (!selected.enabled && !websiteUrl.trim())
                    }
                    onClick={() => void syncWebsite(selected.id, "refresh")}
                  >
                    Refresh
                  </button>
                  {selected.enabled ? (
                    <button
                      type="button"
                      className="btn-ink bg-white text-sm px-4 py-2"
                      disabled={websiteSyncing}
                      onClick={() => void disconnectSynced(selected.id)}
                    >
                      Disconnect
                    </button>
                  ) : null}
                </div>
                <WebsiteSyncProgress active={websiteSyncing} />
                {websiteError ? (
                  <p
                    className="text-sm rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-900"
                    role="alert"
                  >
                    {websiteError}
                  </p>
                ) : null}
                {websiteSuccess && !websiteSyncing ? (
                  <p
                    className="text-sm rounded-lg border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-2"
                    role="status"
                  >
                    {websiteSuccess}
                  </p>
                ) : null}
              </div>
            ) : null}

            {selected.dataMode === "import" &&
            selected.implemented &&
            selected.ingestKind === "upload" ? (
              <div className="space-y-3 border-t border-[var(--ink)]/10 pt-3">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium">Upload PDF</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="block w-full text-sm"
                    onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                    disabled={busyId === selected.id}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-ink bg-[var(--ink)] text-white text-sm px-4 py-2"
                    disabled={busyId === selected.id || !pdfFile}
                    onClick={() => void uploadPdf(selected.id)}
                  >
                    {busyId === selected.id ? "Processing…" : "Upload & ingest"}
                  </button>
                  {selected.enabled ? (
                    <button
                      type="button"
                      className="btn-ink bg-white text-sm px-4 py-2"
                      disabled={busyId === selected.id}
                      onClick={() => void disconnectSynced(selected.id)}
                    >
                      Disconnect
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            {selected.dataMode === "import" &&
            selected.implemented &&
            selected.ingestKind === "schema" ? (
              <DatabaseConnectPanel
                integrationId={selected.id}
                enabled={selected.enabled}
                credentialsConfigured={selected.credentialsConfigured}
                busy={dbBusy}
                error={dbError}
                success={dbSuccess}
                connectionUrl={connectionUrl}
                onConnectionUrlChange={(v) => {
                  setConnectionUrl(v);
                  setDbError(null);
                  setDbSuccess(null);
                }}
                onConnect={() => void connectDatabase(selected.id)}
                onDisconnect={() => void disconnectSynced(selected.id)}
              />
            ) : null}

            {selected.knowledge && selected.knowledge.sourceCount > 0 ? (
              <div className="space-y-2 border-t border-[var(--ink)]/10 pt-3">
                <SectionLabel>Stored knowledge</SectionLabel>
                <p className="caption text-xs">
                  {selected.knowledge.documentCount} documents ·{" "}
                  {selected.knowledge.chunkCount} chunks
                </p>
                <ul className="space-y-2">
                  {selected.knowledge.sources.map((s) => (
                    <li
                      key={s.id}
                      className="rounded-lg border border-[var(--ink)]/12 px-3 py-2 text-sm space-y-1"
                    >
                      <div className="font-medium truncate">{s.name}</div>
                      <div className="caption text-xs flex flex-wrap gap-2">
                        {s.type ? <span>{s.type}</span> : null}
                        {typeof s.documentCount === "number" ? (
                          <span>{s.documentCount} docs</span>
                        ) : null}
                        {s.originUri ? (
                          <a
                            href={s.originUri}
                            target="_blank"
                            rel="noreferrer"
                            className="underline"
                          >
                            Origin
                          </a>
                        ) : null}
                        {s.hasStoredFile ? (
                          <a
                            href={`/api/v1/integrations/knowledge?${
                              selected.id === "pdf"
                                ? `documentId=${encodeURIComponent(s.id)}`
                                : `sourceId=${encodeURIComponent(s.id)}`
                            }`}
                            className="underline"
                          >
                            Download
                          </a>
                        ) : null}
                        {selected.id === "pdf" ? (
                          <button
                            type="button"
                            className="underline"
                            disabled={busyId === selected.id}
                            onClick={() =>
                              void deleteDocument(selected.id, s.id)
                            }
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {selected.dataMode === "connect" &&
            selected.connectable &&
            selected.implemented ? (
              <div className="space-y-3 border-t border-[var(--ink)]/10 pt-3">
                {selected.id === "calendly" ? (
                  <label className="block space-y-1 text-sm">
                    <span className="font-medium">Scheduling link</span>
                    <input
                      type="url"
                      className="ink-input w-full py-2 text-sm"
                      placeholder="https://calendly.com/you/30min"
                      value={bookingUrl}
                      onChange={(e) => setBookingUrl(e.target.value)}
                      disabled={busyId === selected.id}
                    />
                    <span className="caption text-xs">
                      Public Calendly or Cal.com event URL used by the Booking
                      Agent.
                    </span>
                  </label>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {selected.enabled ? (
                    <>
                      {selected.id === "calendly" ? (
                        <button
                          type="button"
                          className="btn-ink bg-[var(--ink)] text-white text-sm px-4 py-2"
                          disabled={
                            busyId === selected.id || !bookingUrl.trim()
                          }
                          onClick={() =>
                            void setEnabled(selected.id, true, {
                              bookingUrl: bookingUrl.trim(),
                            })
                          }
                        >
                          Save link
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-ink bg-white text-sm px-4 py-2"
                        disabled={busyId === selected.id}
                        onClick={() => void setEnabled(selected.id, false)}
                      >
                        Disconnect
                      </button>
                    </>
                  ) : selected.available ? (
                    <button
                      type="button"
                      className="btn-ink bg-[var(--ink)] text-white text-sm px-4 py-2"
                      disabled={
                        busyId === selected.id ||
                        (selected.id === "calendly" && !bookingUrl.trim())
                      }
                      onClick={() =>
                        void setEnabled(
                          selected.id,
                          true,
                          selected.id === "calendly"
                            ? { bookingUrl: bookingUrl.trim() }
                            : undefined,
                        )
                      }
                    >
                      Connect
                    </button>
                  ) : (
                    <a
                      href="/dashboard/settings?section=billing"
                      className="btn-ink bg-[var(--ink)] text-white text-sm px-4 py-2 inline-flex items-center"
                    >
                      Upgrade to connect
                    </a>
                  )}
                </div>
              </div>
            ) : null}

            {!selected.connectable ? (
              <p className="caption text-sm border-t border-[var(--ink)]/10 pt-3">
                Not available to connect yet.
              </p>
            ) : null}
          </aside>
        </>
      ) : null}
    </div>
  );
}

function IntegrationCard({
  item,
  busy,
  onOpen,
}: {
  item: IntegrationRow;
  busy: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={busy}
      className="text-left rounded-xl border border-[var(--ink)]/15 bg-white p-4 space-y-2 hover:border-[var(--ink)]/40 transition-colors w-full"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[var(--ink)]/15 text-[0.65rem]">
            <IntegrationLogo
              name={item.name}
              logoUrl={item.logoUrl}
              className="h-full w-full text-[0.65rem]"
            />
          </span>
          <div className="min-w-0">
            <div className="font-medium truncate">{item.name}</div>
            <DataModeBadge mode={item.dataMode} />
          </div>
        </div>
        <StatusPill state={item.uiState} />
      </div>
      <p className="caption text-xs line-clamp-2">{item.description}</p>
      {item.knowledge && item.knowledge.sourceCount > 0 ? (
        <p className="caption text-[0.65rem]">
          {item.knowledge.sourceCount} source
          {item.knowledge.sourceCount === 1 ? "" : "s"} ·{" "}
          {item.knowledge.chunkCount} chunks
        </p>
      ) : null}
      {item.lastSyncAt ? (
        <p className="caption text-[0.65rem]">Last sync {item.lastSyncAt}</p>
      ) : null}
    </button>
  );
}
