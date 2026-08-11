export type ConversationLifecycleStatus = "open" | "escalated" | "resolved";

export type EscalationTrigger =
  | "customer_request"
  | "unhelpful"
  | "frustration"
  | "business_rule"
  | "low_confidence"
  | "configured";

export interface ConversationStateRecord {
  id: string;
  organizationId: string;
  threadId: string;
  status: ConversationLifecycleStatus;
  assignedAgentId: string | null;
  escalationReason: string | null;
  escalatedAt: string | null;
  /** True when status is escalated or resolved — AI must not reply. */
  aiPaused: boolean;
  updatedAt: string | null;
  createdAt: string | null;
}

export interface EscalateConversationInput {
  organizationId: string;
  threadId: string;
  reason: string;
  trigger: EscalationTrigger;
  summary?: string;
  escalatedByAgentId?: string | null;
  assignedTeam?: string | null;
  context?: {
    customer?: {
      id?: string | null;
      name?: string | null;
      email?: string | null;
      company?: string | null;
      anonymous?: boolean;
    } | null;
    transcript?: Array<{ role: string; content: string; created_at?: string }>;
    lead?: {
      id?: string | null;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      company?: string | null;
      status?: string | null;
    } | null;
    pagePath?: string | null;
    tags?: string[];
    agentName?: string | null;
  };
}

export interface EngagementSettings {
  organizationId: string;
  humanHandoffEnabled: boolean;
  escalationConditions: {
    explicitHumanRequest: boolean;
    repeatedUnhelpful: boolean;
    frustration: boolean;
    lowConfidence: boolean;
    businessRules: boolean;
  };
  defaultTeam: string;
  availabilityMode: "always" | "business_hours" | "collect_contact";
  businessHoursNote: string;
  customerHandoffMessage: string;
  unavailableMessage: string;
}

export const DEFAULT_ENGAGEMENT_SETTINGS: Omit<
  EngagementSettings,
  "organizationId"
> = {
  humanHandoffEnabled: true,
  escalationConditions: {
    explicitHumanRequest: true,
    repeatedUnhelpful: true,
    frustration: true,
    lowConfidence: true,
    businessRules: true,
  },
  defaultTeam: "support",
  availabilityMode: "collect_contact",
  businessHoursNote:
    "Our team typically replies within one business day.",
  customerHandoffMessage:
    "I’ve sent your request to our team along with the conversation details. They’ll review it and get back to you as soon as possible.",
  unavailableMessage:
    "I’ve sent your request to our team along with the conversation details. They’ll review it and get back to you as soon as possible.",
};
