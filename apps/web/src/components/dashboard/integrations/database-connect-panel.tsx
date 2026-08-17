"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import {
  DATABASE_CLOUD_PROVIDERS,
  DATABASE_PRIVATE_PROVIDERS,
  SUPABASE_CONNECTION_URL_EXAMPLES,
  SUPABASE_READONLY_SETUP_SQL,
  type DatabaseDeploymentKind,
  type DatabaseProviderId,
  type DatabaseProviderOption,
  type SupabaseSetupMethod,
} from "@neylonai/sdk";
import { cn } from "@/lib/utils";
import { DATABASE_CODING_AGENT_SKILL } from "./database-coding-agent-skill";

type Props = {
  integrationId: string;
  enabled: boolean;
  credentialsConfigured?: boolean;
  busy: boolean;
  error: string | null;
  success: string | null;
  connectionUrl: string;
  onConnectionUrlChange: (value: string) => void;
  onConnect: () => void;
  onDisconnect: () => void;
};

function ChoiceCard({
  title,
  description,
  selected,
  disabled,
  badge,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "text-left rounded-lg border px-3 py-3 space-y-1 transition-colors",
        selected
          ? "border-[var(--ink)] bg-[var(--cream)]"
          : "border-[var(--ink)]/15 hover:border-[var(--ink)]/35 bg-white",
        disabled && "opacity-55 cursor-not-allowed hover:border-[var(--ink)]/15",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        {badge ? (
          <span className="sticker sticker-lowercase text-[0.6rem] bg-[var(--cream)] text-[var(--ink)]">
            {badge}
          </span>
        ) : null}
      </div>
      <p className="caption text-xs">{description}</p>
    </button>
  );
}

function ProviderList({
  providers,
  selectedId,
  onSelect,
}: {
  providers: readonly DatabaseProviderOption[];
  selectedId: DatabaseProviderId | null;
  onSelect: (id: DatabaseProviderId) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {providers.map((p) => (
        <ChoiceCard
          key={p.id}
          title={p.name}
          description={p.description}
          selected={selectedId === p.id}
          disabled={p.status !== "available"}
          badge={
            p.status === "upcoming"
              ? p.upcomingNote ?? "upcoming"
              : undefined
          }
          onClick={() => {
            if (p.status === "available") onSelect(p.id);
          }}
        />
      ))}
    </div>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium">{label}</p>
        <button
          type="button"
          className="caption text-[0.65rem] underline underline-offset-2"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {
              /* ignore */
            }
          }}
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="text-[0.7rem] leading-relaxed overflow-x-auto rounded-lg border border-[var(--ink)]/15 bg-[var(--cream)] p-3 whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

function ManualSupabaseGuide() {
  return (
    <div className="space-y-3 text-sm">
      <p className="caption text-xs">
        Based on Supabase docs for{" "}
        <a
          className="underline"
          href="https://supabase.com/docs/guides/database/postgres/roles"
          target="_blank"
          rel="noreferrer"
        >
          roles
        </a>{" "}
        and{" "}
        <a
          className="underline"
          href="https://supabase.com/docs/guides/database/connecting-to-postgres"
          target="_blank"
          rel="noreferrer"
        >
          connecting to Postgres
        </a>
        . Neylon only needs a dedicated read-only role — never the{" "}
        <code className="mono text-[0.7rem]">postgres</code> superuser or{" "}
        <code className="mono text-[0.7rem]">service_role</code> API key.
      </p>

      <ol className="list-decimal pl-4 space-y-3 caption text-xs">
        <li>
          <span className="font-medium text-[var(--ink)]">
            Open your Supabase project
          </span>
          <p className="mt-1">
            Dashboard → select the project that holds the data Neylon should
            answer about.
          </p>
        </li>
        <li>
          <span className="font-medium text-[var(--ink)]">
            Create the read-only role
          </span>
          <p className="mt-1">
            Go to{" "}
            <strong>SQL Editor</strong> → New query. Replace{" "}
            <code className="mono">replace-with-a-strong-password</code> with a
            unique password, then run:
          </p>
        </li>
      </ol>

      <CopyBlock label="SQL (SQL Editor)" value={SUPABASE_READONLY_SETUP_SQL} />

      <ol className="list-decimal pl-4 space-y-3 caption text-xs" start={3}>
        <li>
          <span className="font-medium text-[var(--ink)]">
            Copy a connection string pattern
          </span>
          <p className="mt-1">
            Click <strong>Connect</strong> at the top of the project. Prefer{" "}
            <strong>Session pooler</strong> (port 5432 on{" "}
            <code className="mono">*.pooler.supabase.com</code>) for IPv4 SaaS
            backends. Direct host{" "}
            <code className="mono">db.&lt;ref&gt;.supabase.co</code> is often
            IPv6-only unless you have the IPv4 add-on.
          </p>
          <p className="mt-1">
            Change the username to{" "}
            <code className="mono">neylon_readonly</code> (pooler form is often{" "}
            <code className="mono">neylon_readonly.&lt;project-ref&gt;</code>
            ). Put your role password in the URL. Percent-encode special
            characters in the password.
          </p>
        </li>
        <li>
          <span className="font-medium text-[var(--ink)]">
            Security checklist
          </span>
          <ul className="mt-1 list-disc pl-4 space-y-1">
            <li>SELECT only — no INSERT / UPDATE / DELETE / DDL</li>
            <li>Do not share the dashboard database password for postgres</li>
            <li>
              Optional: restrict network access / allowlist Neylon egress in
              Supabase database settings
            </li>
            <li>
              Neylon encrypts the URL at rest and never shows it again in the UI
            </li>
          </ul>
        </li>
        <li>
          <span className="font-medium text-[var(--ink)]">
            Paste below and connect
          </span>
          <p className="mt-1">
            Neylon introspects schema into knowledge and runs validated read-only
            queries later. It does not copy or sync your database.
          </p>
        </li>
      </ol>

      <div className="space-y-2">
        <p className="text-xs font-medium">Example URL shapes</p>
        <pre className="text-[0.65rem] leading-relaxed overflow-x-auto rounded-lg border border-[var(--ink)]/15 bg-white p-3 whitespace-pre-wrap">
          {`Session pooler:\n${SUPABASE_CONNECTION_URL_EXAMPLES.sessionPooler}\n\nDirect:\n${SUPABASE_CONNECTION_URL_EXAMPLES.direct}`}
        </pre>
      </div>
    </div>
  );
}

function CliSupabaseGuide() {
  const [copied, setCopied] = useState(false);

  const copyInstructions = async () => {
    try {
      await navigator.clipboard.writeText(DATABASE_CODING_AGENT_SKILL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5 text-sm">
      <p className="caption text-sm">
        Your coding agent will guide you through selecting the Supabase project,
        creating a least-privilege <code className="mono">neylon_readonly</code>{" "}
        role, and verifying that writes are blocked.
      </p>

      <ol className="grid gap-3 md:grid-cols-3">
        <li className="rounded-xl border border-[var(--ink)]/15 bg-white p-4">
          <span className="mono text-xs opacity-50">1</span>
          <h3 className="mt-2 font-medium">Copy the instructions</h3>
          <p className="caption mt-1 text-sm">
            Paste the complete setup guide into your coding agent.
          </p>
        </li>
        <li className="rounded-xl border border-[var(--ink)]/15 bg-white p-4">
          <span className="mono text-xs opacity-50">2</span>
          <h3 className="mt-2 font-medium">Review each action</h3>
          <p className="caption mt-1 text-sm">
            Confirm the project and approve authentication or database changes.
          </p>
        </li>
        <li className="rounded-xl border border-[var(--ink)]/15 bg-white p-4">
          <span className="mono text-xs opacity-50">3</span>
          <h3 className="mt-2 font-medium">Paste the URL</h3>
          <p className="caption mt-1 text-sm">
            Add the verified read-only connection URL below.
          </p>
        </li>
      </ol>

      <div className="overflow-hidden rounded-xl border border-[var(--ink)]/20 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ink)]/10 px-4 py-3">
          <div>
            <h3 className="font-medium">Coding agent instructions</h3>
            <p className="caption text-xs">Paste directly into your agent.</p>
          </div>
          <button
            type="button"
            className="btn-ink flex size-9 items-center justify-center bg-white p-0"
            onClick={() => void copyInstructions()}
            aria-label={
              copied
                ? "Database setup instructions copied"
                : "Copy database setup instructions"
            }
            title={copied ? "Copied" : "Copy instructions"}
          >
            {copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
          </button>
        </div>
        <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap p-4 text-xs leading-relaxed">
          {DATABASE_CODING_AGENT_SKILL}
        </pre>
      </div>
    </div>
  );
}

function ConnectionUrlField(props: {
  enabled: boolean;
  credentialsConfigured?: boolean;
  busy: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium">Connection URL</span>
      <input
        className="ink-input w-full text-sm"
        type="password"
        autoComplete="off"
        placeholder={
          props.credentialsConfigured || props.enabled
            ? "Credentials on file — paste a new URL to rotate"
            : "postgresql://neylon_readonly…@….pooler.supabase.com:5432/postgres"
        }
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        disabled={props.busy}
      />
      {props.credentialsConfigured || props.enabled ? (
        <p className="caption text-xs">
          Connection credentials are stored encrypted and never shown again.
          Paste a new URL only to reconnect or rotate.
        </p>
      ) : (
        <p className="caption text-xs">
          Write-only. Neylon stores this in the integration vault after connect.
        </p>
      )}
    </label>
  );
}

export function DatabaseConnectPanel({
  enabled,
  credentialsConfigured,
  busy,
  error,
  success,
  connectionUrl,
  onConnectionUrlChange,
  onConnect,
  onDisconnect,
}: Props) {
  const [deployment, setDeployment] = useState<DatabaseDeploymentKind | null>(
    enabled || credentialsConfigured ? "cloud" : null,
  );
  const [providerId, setProviderId] = useState<DatabaseProviderId | null>(
    enabled || credentialsConfigured ? "supabase" : null,
  );
  const [method, setMethod] = useState<SupabaseSetupMethod | null>(
    enabled || credentialsConfigured ? "manual" : null,
  );

  const showSupabaseFlow = deployment === "cloud" && providerId === "supabase";
  const showConnectForm =
    showSupabaseFlow && (method === "manual" || method === "cli");

  return (
    <div className="space-y-4 border-t border-[var(--ink)]/10 pt-3">
      <div className="space-y-2">
        <p className="text-sm font-medium">Connect a database</p>
        <p className="caption text-xs">
          Neylon uses a read-only Postgres role to introspect schema and answer
          with live SELECT queries. No database copy or sync.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium">1. Deployment</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <ChoiceCard
            title="Cloud Database"
            description="Hosted Postgres with a public or pooler endpoint (Supabase available now)."
            selected={deployment === "cloud"}
            onClick={() => {
              setDeployment("cloud");
              setProviderId(null);
              setMethod(null);
            }}
          />
          <ChoiceCard
            title="Private Database"
            description="VPS, on-prem, localhost, or private VPC — outbound connector required."
            selected={deployment === "private"}
            badge="upcoming"
            onClick={() => {
              setDeployment("private");
              setProviderId(null);
              setMethod(null);
            }}
          />
        </div>
      </div>

      {deployment === "cloud" ? (
        <div className="space-y-2">
          <p className="text-xs font-medium">2. Cloud provider</p>
          <ProviderList
            providers={DATABASE_CLOUD_PROVIDERS}
            selectedId={providerId}
            onSelect={(id) => {
              setProviderId(id);
              setMethod(null);
            }}
          />
        </div>
      ) : null}

      {deployment === "private" ? (
        <div className="space-y-2">
          <p className="text-xs font-medium">2. Private targets</p>
          <p className="caption text-xs rounded-lg border border-[var(--ink)]/12 bg-[var(--cream)]/50 px-3 py-2">
            Private databases cannot accept inbound connections from Neylon yet.
            An outbound customer-side connector is planned. Providers below are
            listed so you can see what is coming.
          </p>
          <ProviderList
            providers={DATABASE_PRIVATE_PROVIDERS}
            selectedId={providerId}
            onSelect={() => undefined}
          />
        </div>
      ) : null}

      {showSupabaseFlow ? (
        <div className="space-y-2">
          <p className="text-xs font-medium">3. Supabase setup method</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ChoiceCard
              title="Manual setup"
              description="Step-by-step in the Supabase dashboard + SQL Editor."
              selected={method === "manual"}
              onClick={() => setMethod("manual")}
            />
            <ChoiceCard
              title="Configure with coding agent"
              description="Copy a guided Supabase setup into your coding agent."
              selected={method === "cli"}
              onClick={() => setMethod("cli")}
            />
          </div>
        </div>
      ) : null}

      {method === "manual" && showSupabaseFlow ? (
        <div className="space-y-3 rounded-lg border border-[var(--ink)]/12 p-3">
          <p className="text-sm font-medium">Manual setup</p>
          <ManualSupabaseGuide />
        </div>
      ) : null}

      {method === "cli" && showSupabaseFlow ? (
        <div className="space-y-3 rounded-lg border border-[var(--ink)]/12 p-3">
          <p className="text-sm font-medium">Configure with coding agent</p>
          <CliSupabaseGuide />
        </div>
      ) : null}

      {showConnectForm ? (
        <div className="space-y-3">
          <ConnectionUrlField
            enabled={enabled}
            credentialsConfigured={credentialsConfigured}
            busy={busy}
            value={connectionUrl}
            onChange={onConnectionUrlChange}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ink bg-[var(--ink)] text-white text-sm px-4 py-2"
              disabled={busy || !connectionUrl.trim()}
              onClick={onConnect}
            >
              {busy
                ? "Connecting…"
                : enabled
                  ? "Reconnect & reimport schema"
                  : "Connect & import schema"}
            </button>
            {enabled ? (
              <button
                type="button"
                className="btn-ink bg-white text-sm px-4 py-2"
                disabled={busy}
                onClick={onDisconnect}
              >
                Disconnect
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p
          className="text-sm rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-red-900"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {success && !busy ? (
        <p
          className="text-sm rounded-lg border border-[var(--green)]/30 bg-[var(--green)]/10 px-3 py-2"
          role="status"
        >
          {success}
        </p>
      ) : null}
    </div>
  );
}
