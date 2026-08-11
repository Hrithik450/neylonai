import { UsersRepository } from "./users.repository";
import type { UserResponse } from "./users.types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class UsersService {
  static async findOrCreateGoogleUser(data: {
    google_id: string;
    email: string;
    name: string;
    picture: string;
  }): Promise<{ user: UserResponse["data"]; created: boolean }> {
    const existing = await UsersRepository.findByGoogleId(data.google_id);

    if (existing) {
      const updated = await UsersRepository.updateUser(existing.id, {
        first_name: data.name,
        profile_image: data.picture,
      });
      return { user: updated ?? existing, created: false };
    }

    const user = await UsersRepository.createUser({
      google_id: data.google_id,
      username: data.email,
      email: data.email,
      first_name: data.name,
      profile_image: data.picture,
    });
    return { user, created: true };
  }

  static async getUserById(id: string): Promise<UserResponse> {
    try {
      const user = await UsersRepository.findById(id);
      if (!user) return { success: false, error: "User not found" };
      return { success: true, data: user };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch user",
      };
    }
  }

  /**
   * Ensure a durable anonymous visitor row exists so threads.user_id FK succeeds.
   * Idempotent — safe to call on every chat turn.
   */
  static async ensureAnonymousUser(id: string): Promise<UserResponse> {
    if (!UUID_RE.test(id.trim())) {
      return { success: false, error: "Invalid anonymous user id" };
    }
    const userId = id.trim();
    try {
      const existing = await UsersRepository.findById(userId);
      if (existing) return { success: true, data: existing };

      const short = userId.replace(/-/g, "").slice(0, 12);
      const user = await UsersRepository.createUser({
        id: userId,
        google_id: null,
        username: `anon_${short}`,
        email: `anon-${userId}@anonymous.neylonai.local`,
        first_name: "Guest",
        role: "anonymous",
      });
      return { success: true, data: user };
    } catch (error) {
      // Race: another request created the same id — re-read.
      const raced = await UsersRepository.findById(userId);
      if (raced) return { success: true, data: raced };
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to ensure anonymous user",
      };
    }
  }
}
