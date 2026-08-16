"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "./settings-nav";
import { GeneralSettingsSection } from "./general-section";
import { ApiKeysSettingsSection } from "./api-keys-section";
import { DataPrivacySettingsSection } from "./data-privacy-section";
import { DeveloperSettingsSection } from "./developer-section";
import { BillingSettingsSection } from "./billing-section";

function isSectionId(value: string | null): value is SettingsSectionId {
  if (value === "security") return false;
  return SETTINGS_SECTIONS.some((s) => s.id === value);
}

function resolveSection(param: string | null): SettingsSectionId {
  if (param === "security") return "api-keys";
  if (isSectionId(param)) return param;
  return "general";
}

/**
 * Organization settings center.
 * Product config stays in Widget / Agents / Integrations / Conversations.
 */
export function SettingsCenter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get("section");
  const [section, setSection] = useState<SettingsSectionId>(
    resolveSection(sectionParam),
  );

  useEffect(() => {
    setSection(resolveSection(sectionParam));
  }, [sectionParam]);

  const selectSection = (id: SettingsSectionId) => {
    setSection(id);
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl sm:text-4xl">Settings</h1>
        <p className="caption text-sm max-w-2xl">
          Organization and account configuration.
        </p>
      </header>

      <div className="ink-card overflow-hidden grid lg:grid-cols-[14rem_minmax(0,1fr)] min-h-[70vh]">
        <aside className="border-b lg:border-b-0 lg:border-r border-[var(--ink)]/15 bg-[var(--cream)]/40 p-4">
          <nav
            className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0"
            aria-label="Settings"
          >
            {SETTINGS_SECTIONS.map((item) => {
              const active = section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  className={cn(
                    "flex-none lg:w-full text-left px-3 py-2.5 rounded-sm border border-transparent cursor-pointer",
                    active
                      ? "bg-[var(--ink)] text-white"
                      : "hover:bg-white hover:border-[var(--ink)]/20",
                  )}
                >
                  <span className="text-sm font-medium block">{item.label}</span>
                  <span
                    className={cn(
                      "block text-[0.65rem] leading-snug line-clamp-2 mt-0.5",
                      active ? "text-white/75" : "text-[var(--muted)]",
                    )}
                  >
                    {item.description}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="p-5 sm:p-8 min-w-0">
          {section === "general" ? <GeneralSettingsSection /> : null}
          {section === "api-keys" ? <ApiKeysSettingsSection /> : null}
          {section === "data-privacy" ? <DataPrivacySettingsSection /> : null}
          {section === "developer" ? <DeveloperSettingsSection /> : null}
          {section === "billing" ? <BillingSettingsSection /> : null}
        </div>
      </div>
    </div>
  );
}
