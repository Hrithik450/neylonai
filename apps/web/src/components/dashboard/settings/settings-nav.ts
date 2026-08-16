export type SettingsSectionId =
  | "general"
  | "api-keys"
  | "data-privacy"
  | "developer"
  | "billing";

export const SETTINGS_SECTIONS: Array<{
  id: SettingsSectionId;
  label: string;
  description: string;
}> = [
  {
    id: "general",
    label: "General",
    description: "Organization name and timezone",
  },
  {
    id: "api-keys",
    label: "API keys",
    description: "Keys and allowed domains",
  },
  {
    id: "data-privacy",
    label: "Data & Privacy",
    description: "Conversation retention",
  },
  {
    id: "developer",
    label: "Developer",
    description: "SDK installation guide",
  },
  {
    id: "billing",
    label: "Billing & Plan",
    description: "Subscription and payment",
  },
];
