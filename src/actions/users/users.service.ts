import { UsersModel } from "./users.model";
import type { CreateUserInput, UpdateUserInput, UserResponse } from "./users.types";

export class UsersService {
  static async findOrCreateGoogleUser(data: {
    google_id: string;
    email: string;
    name: string;
    picture: string;
  }): Promise<{ user: UserResponse["data"]; created: boolean }> {
    const existing = await UsersModel.findByGoogleId(data.google_id);

    if (existing) {
      const updated = await UsersModel.updateUser(existing.id, {
        first_name: data.name,
        profile_image: data.picture,
      });
      return { user: updated ?? existing, created: false };
    }

    const user = await UsersModel.createUser({
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
      const user = await UsersModel.findById(id);
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
