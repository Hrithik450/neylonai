import type { OrganizationPrivacyPrefs } from "@neylonai/database";

export type { OrganizationPrivacyPrefs };

export interface OrganizationSettings {
  organizationId: string;
  organizationName: string;
  timezone: string;
  privacy: OrganizationPrivacyPrefs;
}

export interface OrganizationSettingsPatch {
  organizationName?: string;
  timezone?: string;
  privacy?: Partial<OrganizationPrivacyPrefs>;
}

export const DEFAULT_PRIVACY: OrganizationPrivacyPrefs = {
  conversationRetentionDays: 365,
};
