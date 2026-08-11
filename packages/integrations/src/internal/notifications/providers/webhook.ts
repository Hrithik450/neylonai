import { notificationProviders } from "../registry";
import type { NotificationProvider, NotificationPayload } from "../types";

/** Posts alerts to a Slack or Discord webhook URL (`TEAM_WEBHOOK_URL`). */
export const webhookNotificationProvider: NotificationProvider = {
  name: "webhook",
  async notify(payload: NotificationPayload): Promise<void> {
    const webhookUrl = process.env.TEAM_WEBHOOK_URL;
    if (!webhookUrl) return;

    const title = payload.title ?? "Neylon AI alert";
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `${title}\n\n${payload.summary}${
            payload.referenceId
              ? `\n\nReference: ${payload.referenceId}`
              : ""
          }`,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("webhook notification failed:", error);
    }
  },
};

notificationProviders.register(
  webhookNotificationProvider.name,
  webhookNotificationProvider,
);
