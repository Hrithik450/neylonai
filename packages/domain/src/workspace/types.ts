import type { OrganizationPrivacyPrefs } from "@neylonai/database";

export type { OrganizationPrivacyPrefs };

export interface OrganizationSettings {
  organizationId: string;
  organizationName: string;
  timezone: string;
  /** Site builder chosen during onboarding; null until picked. */
  websitePlatform: string | null;
  privacy: OrganizationPrivacyPrefs;
}

export interface OrganizationSettingsPatch {
  organizationName?: string;
  timezone?: string;
  websitePlatform?: string;
  privacy?: Partial<OrganizationPrivacyPrefs>;
}

export const DEFAULT_PRIVACY: OrganizationPrivacyPrefs = {
  conversationRetentionDays: 365,
};
