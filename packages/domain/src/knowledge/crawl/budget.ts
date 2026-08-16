import { and, eq, sql } from "drizzle-orm";
import { db, websiteCrawlBudgetMonths } from "@neylonai/database";
import { fitsWebsiteCrawlBudget } from "./helpers";

function firstRow<T>(result: unknown): T | null {
  if (Array.isArray(result)) return ((result[0] as T) ?? null);
  const rows = (result as { rows?: T[] }).rows;
  return rows?.[0] ?? null;
}

export async function getWebsiteCrawlBudgetUsage(
  organizationId: string,
  yearMonth: string,
): Promise<{ reserved: number; consumed: number; used: number }> {
  const [row] = await db
    .select({
      reserved: websiteCrawlBudgetMonths.reserved,
      consumed: websiteCrawlBudgetMonths.consumed,
    })
    .from(websiteCrawlBudgetMonths)
    .where(
      and(
        eq(websiteCrawlBudgetMonths.organization_id, organizationId),
        eq(websiteCrawlBudgetMonths.year_month, yearMonth),
      ),
    )
    .limit(1);
  const reserved = Number(row?.reserved ?? 0);
  const consumed = Number(row?.consumed ?? 0);
  return { reserved, consumed, used: reserved + consumed };
}

/**
 * Atomically reserve `pages` against the monthly cap.
 * Returns null when the reservation would exceed the plan limit.
 */
export async function reserveWebsiteCrawlBudget(input: {
  organizationId: string;
  yearMonth: string;
  pages: number;
  limit: number;
}): Promise<{ reserved: number; consumed: number } | null> {
  if (input.pages <= 0) {
    return getWebsiteCrawlBudgetUsage(input.organizationId, input.yearMonth);
  }
  const result = await db.execute<{ reserved: number; consumed: number }>(sql`
    INSERT INTO website_crawl_budget_months (
      organization_id, year_month, reserved, consumed
    )
    VALUES (
      ${input.organizationId}::uuid,
      ${input.yearMonth},
      ${input.pages},
      0
    )
    ON CONFLICT (organization_id, year_month)
    DO UPDATE SET
      reserved = website_crawl_budget_months.reserved + EXCLUDED.reserved,
      updated_at = now()
    WHERE website_crawl_budget_months.reserved
        + website_crawl_budget_months.consumed
        + EXCLUDED.reserved
      <= ${input.limit}
    RETURNING reserved, consumed
  `);
  return firstRow(result);
}

export async function consumeWebsiteCrawlBudget(input: {
  organizationId: string;
  yearMonth: string;
  pages: number;
}): Promise<void> {
  if (input.pages <= 0) return;
  await db.execute(sql`
    UPDATE website_crawl_budget_months
    SET
      reserved = GREATEST(reserved - ${input.pages}, 0),
      consumed = consumed + ${input.pages},
      updated_at = now()
    WHERE organization_id = ${input.organizationId}::uuid
      AND year_month = ${input.yearMonth}
  `);
}

export async function releaseWebsiteCrawlBudget(input: {
  organizationId: string;
  yearMonth: string;
  pages: number;
}): Promise<void> {
  if (input.pages <= 0) return;
  await db.execute(sql`
    UPDATE website_crawl_budget_months
    SET
      reserved = GREATEST(reserved - ${input.pages}, 0),
      updated_at = now()
    WHERE organization_id = ${input.organizationId}::uuid
      AND year_month = ${input.yearMonth}
  `);
}

export { fitsWebsiteCrawlBudget };
