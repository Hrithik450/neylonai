import { db, schema } from "@neylonai/database";
import { eq } from "drizzle-orm";
import type { VisitorRecord } from "./visitors.types";

const { visitors } = schema;

function rowToVisitor(row: typeof visitors.$inferSelect): VisitorRecord {
  return {
    id: row.id,
    display_name: row.display_name,
    created_at: row.created_at!.toISOString(),
    updated_at: row.updated_at!.toISOString(),
  };
}

export class VisitorsRepository {
  static async findById(id: string): Promise<VisitorRecord | null> {
    const [row] = await db
      .select()
      .from(visitors)
      .where(eq(visitors.id, id))
      .limit(1);
    return row ? rowToVisitor(row) : null;
  }

  static async createVisitor(data: {
    id: string;
    display_name?: string;
  }): Promise<VisitorRecord> {
    const [row] = await db
      .insert(visitors)
      .values({
        id: data.id,
        display_name: data.display_name ?? "Guest",
      })
      .returning();
    return rowToVisitor(row);
  }

  /** GDPR-style anonymization — preserves thread history without PII. */
  static async anonymizeVisitor(id: string): Promise<VisitorRecord | null> {
    const [row] = await db
      .update(visitors)
      .set({
        display_name: "Anonymous",
        updated_at: new Date(),
      })
      .where(eq(visitors.id, id))
      .returning();
    return row ? rowToVisitor(row) : null;
  }
}
