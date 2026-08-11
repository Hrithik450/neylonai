export interface NotificationPayload {
  /** Short human-readable summary of the event. */
  summary: string;
  /** Optional correlation id (ticket / thread) for traceability. */
  referenceId?: string;
  /** Optional heading (defaults depend on provider). */
  title?: string;
}

/**
 * A provider that can push an event to an external system — a team chat channel today,
 * a CRM (HubSpot, Salesforce, ...) tomorrow. New CRM/integration plugins implement this
 * same contract and register themselves; nothing else in the app needs to change.
 */
export interface NotificationProvider {
  name: string;
  notify(payload: NotificationPayload): Promise<void>;
}
