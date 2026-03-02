import { db } from "@/lib/db";
import { users } from "@/lib/drizzle/schema";
import { eq } from "drizzle-orm";
import type { UserRecord, CreateUserInput, UpdateUserInput } from "./users.types";

function rowToUser(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    google_id: row.google_id ?? null,
    username: row.username,
    email: row.email,
    first_name: row.first_name,
    profile_image: row.profile_image ?? null,
    role: row.role,
    daily_limit: row.daily_limit,
    resume_generation_limit: row.resume_generation_limit,
    created_at: row.created_at!.toISOString(),
    updated_at: row.updated_at!.toISOString(),
  };
}

export class UsersModel {
  static async findByGoogleId(googleId: string): Promise<UserRecord | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.google_id, googleId))
      .limit(1);
    return row ? rowToUser(row) : null;
  }

  static async findById(id: string): Promise<UserRecord | null> {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return row ? rowToUser(row) : null;
  }

  static async createUser(data: CreateUserInput): Promise<UserRecord> {
    const [row] = await db
      .insert(users)
      .values({
        google_id: data.google_id,
        username: data.username,
        email: data.email,
        first_name: data.first_name,
        profile_image: data.profile_image ?? null,
      })
      .returning();
    return rowToUser(row);
  }

  static async updateUser(id: string, data: UpdateUserInput): Promise<UserRecord | null> {
    const [row] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return row ? rowToUser(row) : null;
  }

  static async resetDailyLimits(): Promise<number> {
    const result = await db
      .update(users)
      .set({ daily_limit: 200, resume_generation_limit: 2 })
      .returning({ id: users.id });
    return result.length;
  }
}
