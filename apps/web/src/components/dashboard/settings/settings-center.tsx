"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "./settings-nav";
import { GeneralSettingsSection } from "./general-section";
import { SecuritySettingsSection } from "./security-section";
import { NotificationsSettingsSection } from "./notifications-section";
import { HumanSupportSettingsSection } from "./human-support-section";
import { DataPrivacySettingsSection } from "./data-privacy-section";
import { DeveloperSettingsSection } from "./developer-section";
import { BillingSettingsSection } from "./billing-section";

function isSectionId(value: string | null): value is SettingsSectionId {
  return SETTINGS_SECTIONS.some((s) => s.id === value);
}

/**
 * Account-level Settings center.
 * Feature config stays in Widget / Agents / Integrations / Conversations.
 */
export function SettingsCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get("section");
  const [section, setSection] = useState<SettingsSectionId>(
    isSectionId(sectionParam) ? sectionParam : "general",
  );
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (isSectionId(sectionParam)) setSection(sectionParam);
  }, [sectionParam]);

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SETTINGS_SECTIONS;
    return SETTINGS_SECTIONS.filter((s) => {
      const hay = [s.label, s.description, ...s.keywords].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const selectSection = (id: SettingsSectionId) => {
    setSection(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", id);
    // Preserve upgrade/checkout query for billing deep links.
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">Settings</h1>
        <p className="caption text-sm max-w-2xl">
          Workspace and account configuration. Widget, Agents, Integrations
          (including synced knowledge), and Conversations keep their own product
          settings.
        </p>
      </header>

      <div className="ink-card overflow-hidden grid lg:grid-cols-[14rem_minmax(0,1fr)] min-h-[70vh]">
        <aside className="border-b lg:border-b-0 lg:border-r border-[var(--ink)]/15 bg-[var(--cream)]/40 p-4 space-y-4">
          <label className="block space-y-1.5">
            <span className="mono text-[0.6rem] tracking-[0.16em] uppercase opacity-60">
              Search settings
            </span>
            <input
              className="ink-input py-2 text-sm"
              placeholder="Find a setting…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>

          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0" aria-label="Settings">
            {filteredNav.length === 0 ? (
              <p className="caption text-xs px-2 py-3">No matching sections.</p>
            ) : (
              filteredNav.map((item) => {
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectSection(item.id)}
                    className={cn(
                      "flex-none lg:w-full text-left px-3 py-2.5 rounded-sm border border-transparent",
                      active
                        ? "bg-[var(--ink)] text-white"
                        : "hover:bg-white hover:border-[var(--ink)]/20",
                    )}
                  >
                    <span className="text-sm font-medium block">{item.label}</span>
                    <span
                      className={cn(
                        "caption text-[0.65rem] line-clamp-2",
                        active ? "opacity-70" : "opacity-60",
                      )}
                    >
                      {item.description}
                    </span>
                  </button>
                );
              })
            )}
          </nav>
        </aside>

        <div className="p-5 sm:p-8 min-w-0">
          {section === "general" ? <GeneralSettingsSection /> : null}
          {section === "security" ? <SecuritySettingsSection /> : null}
          {section === "notifications" ? <NotificationsSettingsSection /> : null}
          {section === "human-support" ? <HumanSupportSettingsSection /> : null}
          {section === "data-privacy" ? <DataPrivacySettingsSection /> : null}
          {section === "developer" ? <DeveloperSettingsSection /> : null}
          {section === "billing" ? <BillingSettingsSection /> : null}
        </div>
      </div>
    </div>
  );
}
