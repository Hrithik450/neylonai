import { db, schema } from "@neylonai/database";
import { eq } from "drizzle-orm";
import type { UserRecord, CreateUserInput, UpdateUserInput } from "./users.types";

const { users } = schema;

function rowToUser(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.id,
    google_id: row.google_id ?? null,
    username: row.username,
    email: row.email,
    first_name: row.first_name,
    profile_image: row.profile_image ?? null,
    role: row.role,
    created_at: row.created_at!.toISOString(),
    updated_at: row.updated_at!.toISOString(),
  };
}

export class UsersRepository {
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
        ...(data.id ? { id: data.id } : {}),
        google_id: data.google_id ?? null,
        username: data.username,
        email: data.email,
        first_name: data.first_name,
        profile_image: data.profile_image ?? null,
        ...(data.role ? { role: data.role } : {}),
      })
      .returning();
    return rowToUser(row);
  }

  static async updateUser(
    id: string,
    data: UpdateUserInput,
  ): Promise<UserRecord | null> {
    const [row] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return row ? rowToUser(row) : null;
  }
}
