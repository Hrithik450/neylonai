export type EscalationTrigger =
  | "customer_request"
  | "unhelpful"
  | "frustration"
  | "business_rule"
  | "low_confidence"
  | "configured";

export interface EscalateConversationInput {
  organizationId: string;
  threadId: string;
  /** Short agent/system reason stored on thread_escalations. */
  reason: string;
  trigger?: EscalationTrigger;
  summary?: string;
  /**
   * A contact detail the visitor gave in chat (email, LinkedIn, GitHub, phone…).
   * When present it completes the handoff even if the participant is anonymous,
   * and is included in the team alert.
   */
  providedContact?: string;
}

export type ConversationStatus =
  | "ai_active"
  | "awaiting_contact"
  | "human_pending"
  | "human_active"
  | "resolved";

/** Fixed visitor-facing handoff copy for the MVP. */
export const ESCALATION_CUSTOMER_MESSAGE =
  "I’ve sent your request to our team. A human will review this conversation and contact you shortly.";

export const ESCALATION_CONTACT_MESSAGE =
  "Before I hand this to the team, please share your name and a way to contact you so they can follow up.";
