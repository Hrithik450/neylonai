import type {
  WorkspaceNotificationPrefs,
  WorkspacePrivacyPrefs,
  WorkspaceSsoPrep,
} from "@neylonai/database";

export interface WorkspaceSettings {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  customerFacingName: string | null;
  logoUrl: string | null;
  timezone: string;
  defaultLanguage: string;
  notifications: WorkspaceNotificationPrefs;
  privacy: WorkspacePrivacyPrefs;
  sso: WorkspaceSsoPrep;
  webhookUrl: string | null;
  /** Never the full secret — only last four when configured. */
  webhookSecretLastFour: string | null;
  hasWebhookSecret: boolean;
}

export interface WorkspaceSettingsPatch {
  organizationName?: string;
  customerFacingName?: string | null;
  logoUrl?: string | null;
  timezone?: string;
  defaultLanguage?: string;
  notifications?: Partial<WorkspaceNotificationPrefs>;
  privacy?: Partial<WorkspacePrivacyPrefs>;
  sso?: Partial<WorkspaceSsoPrep>;
  webhookUrl?: string | null;
  /** When true, rotate and return plaintext once. */
  rotateWebhookSecret?: boolean;
  /** Clear stored webhook secret. */
  clearWebhookSecret?: boolean;
}

export const DEFAULT_NOTIFICATIONS: WorkspaceNotificationPrefs = {
  humanHandoffEmail: true,
  humanHandoffSlack: true,
  ticketEmail: true,
  ticketSlack: true,
  leadEmail: true,
  leadSlack: false,
};

export const DEFAULT_PRIVACY: WorkspacePrivacyPrefs = {
  conversationRetentionDays: 365,
  allowDataExport: true,
  anonymizeVisitorIds: false,
};

export const DEFAULT_SSO: WorkspaceSsoPrep = {
  enabled: false,
  provider: null,
  notes: null,
};
