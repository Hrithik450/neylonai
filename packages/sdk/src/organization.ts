/**
 * Browser-safe organization settings types.
 */

export type OrganizationPrivacyPrefs = {
  conversationRetentionDays: number | null;
};

export const DEFAULT_PRIVACY: OrganizationPrivacyPrefs = {
  conversationRetentionDays: 365,
};

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
