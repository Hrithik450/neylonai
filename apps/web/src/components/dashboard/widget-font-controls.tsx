"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_WIDGET_FONT,
  type StoredWidgetConfig,
  type WidgetFontConfig,
} from "@/lib/widget-config-types";

type OrgFontRow = {
  id: string;
  familyName: string;
  originalFilename: string;
  byteSize: number;
  fileUrl: string;
  createdAt: string;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[0.65rem] font-bold tracking-[0.12em] uppercase opacity-60">
      {children}
    </span>
  );
}

export function WidgetFontControls({
  font,
  onChange,
  disabled,
}: {
  font?: WidgetFontConfig;
  onChange: (next: WidgetFontConfig) => void;
  disabled?: boolean;
}) {
  const [orgFonts, setOrgFonts] = useState<OrgFontRow[]>([]);
  const [maxFonts, setMaxFonts] = useState(10);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeId =
    font?.source === "custom" ? (font.customFontId ?? null) : null;
  const busy = uploading || deletingId !== null;

  const refreshFonts = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/org-fonts");
      const json = (await res.json()) as {
        success: boolean;
        data?: { fonts: OrgFontRow[]; max: number };
      };
      if (json.success && json.data) {
        setOrgFonts(json.data.fonts);
        setMaxFonts(json.data.max);
      }
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    void refreshFonts();
  }, [refreshFonts]);

  const applyCustom = (row: OrgFontRow) => {
    onChange({
      source: "custom",
      family: row.familyName,
      customFontId: row.id,
      customFontUrl: row.fileUrl,
      catalogId: undefined,
      cssUrl: undefined,
    });
  };

  const onUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    setNote(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/v1/org-fonts", { method: "POST", body });
      const json = (await res.json()) as {
        success: boolean;
        data?: OrgFontRow;
        error?: string;
      };
      if (!json.success || !json.data) {
        throw new Error(json.error ?? "Upload failed");
      }
      await refreshFonts();
      applyCustom(json.data);
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDelete = async (id: string) => {
    setDeletingId(id);
    setNote(null);
    try {
      const res = await fetch(`/api/v1/org-fonts/${id}`, { method: "DELETE" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!json.success) throw new Error(json.error ?? "Delete failed");

      const remaining = orgFonts.filter((f) => f.id !== id);
      setOrgFonts(remaining);
      await refreshFonts();

      if (font?.customFontId === id) {
        const next = remaining[0];
        if (next) {
          applyCustom(next);
        } else {
          onChange({ ...DEFAULT_WIDGET_FONT });
        }
      }
    } catch (e) {
      setNote(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const atLimit = orgFonts.length >= maxFonts;

  return (
    <div className={`space-y-4 ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <div className="space-y-2">
        <FieldLabel>
          Widget font ({orgFonts.length}/{maxFonts})
        </FieldLabel>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-ink bg-white px-3 py-1.5 text-xs"
            disabled={disabled || uploading || atLimit}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? "Uploading…" : "Choose font file"}
          </button>
          {atLimit ? (
            <span className="caption text-xs self-center">
              Limit reached — delete one to upload another.
            </span>
          ) : (
            <span className="caption text-xs self-center opacity-70">
              .woff2, .woff, .ttf, or .otf
            </span>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".woff2,.woff,.ttf,.otf,font/woff2,font/woff,font/ttf,font/otf"
          className="hidden"
          disabled={disabled || uploading || atLimit}
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            void onUpload(file);
          }}
        />

        {orgFonts.length > 0 ? (
          <ul className="space-y-2">
            {orgFonts.map((f) => {
              const active = activeId === f.id;
              return (
                <li key={f.id}>
                  <div
                    className={`flex items-center justify-between gap-3 rounded-md border bg-white px-3 py-2 text-sm ${
                      active
                        ? "border-[var(--ink)] ring-1 ring-[var(--ink)]/20"
                        : "border-[var(--ink)]/15"
                    }`}
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left cursor-pointer"
                      disabled={busy}
                      onClick={() => applyCustom(f)}
                      aria-pressed={active}
                      aria-label={
                        active
                          ? `${f.familyName} (active)`
                          : `Use ${f.familyName}`
                      }
                    >
                      <p
                        className="font-medium truncate"
                        style={{
                          fontFamily: `"${f.familyName}", sans-serif`,
                        }}
                      >
                        {f.familyName}
                      </p>
                      <p className="caption text-xs opacity-60">
                        {(f.byteSize / 1024).toFixed(0)} KB
                        {active ? (
                          <span className="ml-2 mono font-bold uppercase tracking-wide text-[0.6rem] text-[var(--ink)] opacity-100">
                            Active
                          </span>
                        ) : null}
                      </p>
                    </button>
                    <button
                      type="button"
                      className="btn-ink bg-white px-3 py-1.5 text-xs shrink-0"
                      disabled={busy}
                      onClick={() => void onDelete(f.id)}
                    >
                      {deletingId === f.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="caption text-xs opacity-70">
            No fonts uploaded yet. Use Choose font file to add one.
          </p>
        )}
      </div>

      {note ? <p className="caption text-sm">{note}</p> : null}
    </div>
  );
}

/** Helper for parent patch wiring. */
export function patchBrandingFont(
  prev: StoredWidgetConfig,
  font: WidgetFontConfig,
): StoredWidgetConfig {
  return {
    ...prev,
    branding: {
      ...prev.branding,
      font,
    },
  };
}
