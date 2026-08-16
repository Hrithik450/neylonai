"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { integrationLogoLetters } from "@neylonai/integrations/catalog";

export type IntegrationRow = {
  id: string;
  name: string;
  description: string;
  logoUrl: string | null;
  enabled: boolean;
  available: boolean;
  uiState: string;
  connectedAccount: string | null;
};

function statusLabel(row: IntegrationRow) {
  if (!row.available) return "Upgrade";
  if (row.enabled) return "Connected";
  return row.uiState === "coming_soon" ? "Coming soon" : "Available";
}

export function IntegrationsPanel() {
  const [rows, setRows] = useState<IntegrationRow[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/v1/integrations")
      .then(async (response) => {
        const json = (await response.json()) as {
          success: boolean;
          data?: { integrations: IntegrationRow[] };
          error?: string;
        };
        if (!json.success || !json.data) {
          throw new Error(json.error ?? "Failed to load integrations.");
        }
        setRows(json.data.integrations);
      })
      .catch((reason: unknown) => {
        setError(
          reason instanceof Error ? reason.message : "Failed to load integrations.",
        );
      });
  }, []);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle
      ? rows.filter((row) =>
          `${row.name} ${row.description}`.toLowerCase().includes(needle),
        )
      : rows;
  }, [query, rows]);

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="integrations-heading" className="text-3xl">Integrations</h1>
          <p className="mt-1 text-sm text-[var(--ink)]/65">
            Connect the services your AI uses for knowledge and customer actions.
          </p>
        </div>
        <input
          className="ink-input w-full text-sm sm:w-64"
          type="search"
          placeholder="Search integrations"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((row) => (
          <Link
            key={row.id}
            id={row.name.toLowerCase() === "website" ? "integration-website-card" : undefined}
            href={`/dashboard/integrations/${row.id}`}
            className="group rounded-xl border border-[var(--ink)]/15 bg-white p-4 transition hover:border-[var(--ink)]/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--cream)] font-semibold">
                  {row.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={row.logoUrl} alt="" className="h-7 w-7 object-contain" />
                  ) : (
                    integrationLogoLetters(row.name)
                  )}
                </span>
                <div>
                  <h2 className="font-medium">{row.name}</h2>
                  <span className="caption text-[0.65rem]">{statusLabel(row)}</span>
                </div>
              </div>
              <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
            </div>
            <p className="mt-3 text-sm text-[var(--ink)]/65">{row.description}</p>
            {row.connectedAccount ? (
              <p className="caption mt-3 truncate text-[0.65rem]">
                {row.connectedAccount}
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </section>
  );
}
