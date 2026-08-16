import { UsersRepository } from "./users.repository";
import type { UserResponse } from "./users.types";

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
        username: data.name.trim() || existing.username,
        profile_image: data.picture,
      });
      return { user: updated ?? existing, created: false };
    }

    const user = await UsersRepository.createUser({
      google_id: data.google_id,
      username: data.name.trim() || data.email,
      email: data.email,
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
}
