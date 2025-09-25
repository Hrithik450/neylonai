import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@/lib/drizzle/schema";
import { Pool } from "pg";

if (!process.env.AUTH_DRIZZLE_URL) {
  throw new Error("AUTH_DRIZZLE_URL is not set in environment variables.");
}

const pool = new Pool({
  connectionString: process.env.AUTH_DRIZZLE_URL,
});
export const db = drizzle(pool, { schema });
