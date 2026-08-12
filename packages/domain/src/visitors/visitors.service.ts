import { VisitorsRepository } from "./visitors.repository";
import type { VisitorResponse } from "./visitors.types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class VisitorsService {
  /**
   * Ensure a durable widget visitor row exists so threads.visitor_id FK succeeds.
   * Idempotent — safe to call on every chat turn.
   */
  static async ensureVisitor(id: string): Promise<VisitorResponse> {
    if (!UUID_RE.test(id.trim())) {
      return { success: false, error: "Invalid visitor id" };
    }
    const visitorId = id.trim();
    try {
      const existing = await VisitorsRepository.findById(visitorId);
      if (existing) return { success: true, data: existing };

      const visitor = await VisitorsRepository.createVisitor({ id: visitorId });
      return { success: true, data: visitor };
    } catch (error) {
      const raced = await VisitorsRepository.findById(visitorId);
      if (raced) return { success: true, data: raced };
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to ensure visitor",
      };
    }
  }
}
