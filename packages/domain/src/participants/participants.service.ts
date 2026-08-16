import { ParticipantsRepository } from "./participants.repository";
import type {
  ParticipantInput,
  ParticipantResponse,
} from "./participants.types";

export class ParticipantsService {
  /**
   * Upsert an org-scoped widget participant from the SDK user object.
   * Idempotent — safe on every chat turn.
   */
  static async ensureParticipant(
    organizationId: string,
    input: ParticipantInput,
  ): Promise<ParticipantResponse> {
    if (!organizationId.trim()) {
      return { success: false, error: "organizationId is required" };
    }
    if (!input.externalId?.trim()) {
      return { success: false, error: "participant externalId is required" };
    }
    try {
      const participant = await ParticipantsRepository.upsertParticipant(
        organizationId,
        input,
      );
      return { success: true, data: participant };
    } catch (error) {
      const raced = await ParticipantsRepository.findByOrgAndExternalId(
        organizationId,
        input.externalId.trim(),
      );
      if (raced) return { success: true, data: raced };
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to ensure participant",
      };
    }
  }

  static async identifyParticipant(input: {
    id: string;
    organizationId: string;
    name: string;
    email: string;
  }): Promise<ParticipantResponse> {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 2 || name.length > 255) {
      return { success: false, error: "A valid name is required" };
    }
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return { success: false, error: "A valid email is required" };
    }
    try {
      const participant = await ParticipantsRepository.identifyParticipant({
        ...input,
        name,
        email,
      });
      return participant
        ? { success: true, data: participant }
        : { success: false, error: "Participant not found" };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to update participant",
      };
    }
  }
}
