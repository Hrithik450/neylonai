export type SettingsSectionId =
  | "general"
  | "security"
  | "notifications"
  | "human-support"
  | "data-privacy"
  | "developer"
  | "billing";

export const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  description: string;
  keywords: string[];
}> = [
  {
    id: "general",
    label: "General",
    description: "Workspace identity, timezone, and language",
    keywords: ["name", "company", "logo", "timezone", "language", "brand"],
  },
  {
    id: "security",
    label: "Security",
    description: "API keys, domains, sessions, and SSO prep",
    keywords: ["api", "key", "secret", "domain", "origin", "session", "sso"],
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Handoff and lead alerts",
    keywords: ["email", "slack", "handoff", "lead", "alert"],
  },
  {
    id: "human-support",
    label: "Human Support",
    description: "Business hours, escalations, and handoff messages",
    keywords: [
      "hours",
      "escalation",
      "assignee",
      "team",
      "handoff",
      "unavailable",
    ],
  },
  {
    id: "data-privacy",
    label: "Data & Privacy",
    description: "Retention, export, and deletion",
    keywords: ["retention", "export", "delete", "privacy", "gdpr"],
  },
  {
    id: "developer",
    label: "Developer",
    description: "SDK, webhooks, and documentation",
    keywords: ["sdk", "webhook", "docs", "install", "api"],
  },
  {
    id: "billing",
    label: "Billing & Plan",
    description: "Subscription, invoices, and payment",
    keywords: ["plan", "invoice", "payment", "upgrade", "cancel", "billing"],
  },
];
