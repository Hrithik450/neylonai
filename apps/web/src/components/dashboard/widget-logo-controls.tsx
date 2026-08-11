"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoredWidgetConfig } from "@/lib/widget-config-types";

type OrgLogoRecord = {
  id: string;
  originalFilename: string;
  byteSize: number;
  fileUrl: string;
};

export function WidgetLogoControls({
  logoUrl,
  onLogoUrlChange,
}: {
  logoUrl?: string;
  onLogoUrlChange: (url: string) => void;
}) {
  const [logo, setLogo] = useState<OrgLogoRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/org-logo");
      const json = (await res.json()) as {
        success: boolean;
        data?: { logo: OrgLogoRecord | null; maxBytes?: number };
        error?: string;
      };
      if (json.success && json.data) {
        setLogo(json.data.logo);
      }
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/v1/org-logo", { method: "POST", body });
      const json = (await res.json()) as {
        success: boolean;
        data?: OrgLogoRecord;
        error?: string;
      };
      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Upload failed");
      }
      setLogo(json.data);
      onLogoUrlChange(json.data.fileUrl);
      setMessage("Logo uploaded (max 1). Publish to sync other appearance edits.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/org-logo", { method: "DELETE" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Delete failed");
      setLogo(null);
      onLogoUrlChange("");
      setMessage("Logo removed.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const previewSrc = logoUrl?.trim() || logo?.fileUrl || "";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-4">
        <div className="h-14 min-w-14 max-w-[11rem] rounded-lg border border-[var(--ink)]/20 bg-white px-2 flex items-center justify-center shrink-0">
          {previewSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt="Logo preview"
              className="max-h-10 max-w-full w-auto object-contain"
            />
          ) : (
            <span className="mono text-[0.6rem] opacity-40">None</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="caption text-xs">
            Upload one logo (PNG, JPG, WEBP, GIF, or SVG · max 1 MB).
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-ink bg-white px-3 py-1.5 text-xs"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
            >
              {logo || previewSrc ? "Replace logo" : "Upload logo"}
            </button>
            {logo || previewSrc ? (
              <button
                type="button"
                className="btn-ink bg-white px-3 py-1.5 text-xs"
                disabled={busy}
                onClick={() => void remove()}
              >
                Remove
              </button>
            ) : null}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.png,.jpg,.jpeg,.webp,.gif,.svg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </div>
      </div>
      {message ? <p className="caption text-xs opacity-80">{message}</p> : null}
    </div>
  );
}

export function patchBrandingLogoUrl(
  prev: StoredWidgetConfig,
  logoUrl: string,
): StoredWidgetConfig {
  return {
    ...prev,
    branding: {
      ...prev.branding,
      logoUrl,
    },
  };
}
