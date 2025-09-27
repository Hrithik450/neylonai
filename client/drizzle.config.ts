import "dotenv/config";
import type { Config } from "drizzle-kit";

export default {
  out: "./src/lib/drizzle/migrations",
  schema: "./src/lib/drizzle/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;
