/**
 * Mint a client API key for the platform org and print NEXT_PUBLIC_NEYLONAI_API_KEY.
 * First-party SupportWidget reads that env (same as external embeds) — it does not
 * call private billing/domain code.
 *
 *   pnpm exec dotenv -e .env -- pnpm --filter @neylonai/database exec tsx ../../apps/web/scripts/seed-platform-api-key.ts
 */
import { eq } from "drizzle-orm";
import {
  db,
  organizations,
  subscriptions,
  apiKeys,
} from "@neylonai/database";
import {
  createApiKeyForOrg,
} from "@neylonai/domain/billing";

async function main() {
  const slug =
    process.env.KNOWLEDGE_ORGANIZATION_SLUG?.trim() || "neylonai";

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    console.error(`Organization slug "${slug}" not found. Create it first.`);
    process.exit(1);
  }

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organization_id, org.id))
    .limit(1);

  if (!sub) {
    const end = new Date();
    end.setFullYear(end.getFullYear() + 1);
    await db.insert(subscriptions).values({
      organization_id: org.id,
      status: "active",
      plan: "business",
      monthly_request_limit: null,
      current_period_start: new Date(),
      current_period_end: end,
    });
    console.log("Created active subscription for", slug);
  } else if (sub.status !== "active" && sub.status !== "trialing") {
    await db
      .update(subscriptions)
      .set({ status: "active", updated_at: new Date() })
      .where(eq(subscriptions.id, sub.id));
    console.log("Activated subscription for", slug);
  }

  const existing = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.organization_id, org.id));

  const active = existing.filter((k) => !k.revoked_at);
  if (active.length > 0) {
    console.log(
      "Active key already exists (prefix):",
      active[0]!.key_prefix,
      "…",
      active[0]!.last_four,
    );
    console.log(
      "Regenerate from Settings → Security if you need the plaintext again.",
    );
    process.exit(0);
  }

  const created = await createApiKeyForOrg(org.id, "Platform");
  console.log("\nNEXT_PUBLIC_NEYLONAI_API_KEY=" + created.rawKey);
  console.log("\nAdd the line above to the repo root .env (and restart).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
