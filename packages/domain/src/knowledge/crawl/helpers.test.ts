import { describe, expect, it } from "vitest";
import {
  documentsToRemove,
  fitsWebsiteCrawlBudget,
  lastmodUnchanged,
  usesWebsiteRefreshBudget,
  utcYearMonth,
  websiteReimportAvailableAt,
} from "./helpers";

describe("fitsWebsiteCrawlBudget", () => {
  it("accepts the first reservation up to the plan cap", () => {
    expect(fitsWebsiteCrawlBudget(0, 0, 8, 8)).toBe(true);
    expect(fitsWebsiteCrawlBudget(0, 0, 9, 8)).toBe(false);
  });

  it("rejects concurrent overrun when reservations race", () => {
    const state = { reserved: 0, consumed: 0 };
    const apply = (add: number, limit: number) => {
      if (!fitsWebsiteCrawlBudget(state.reserved, state.consumed, add, limit)) {
        return false;
      }
      state.reserved += add;
      return true;
    };
    expect(apply(8, 8)).toBe(true);
    expect(apply(8, 8)).toBe(false);
    expect(state.reserved).toBe(8);
  });

  it("counts consumed pages against the remaining budget", () => {
    expect(fitsWebsiteCrawlBudget(2, 6, 1, 8)).toBe(false);
    expect(fitsWebsiteCrawlBudget(0, 7, 1, 8)).toBe(true);
  });
});

describe("usesWebsiteRefreshBudget", () => {
  it("counts only explicit refreshes", () => {
    expect(usesWebsiteRefreshBudget("refresh")).toBe(true);
    expect(usesWebsiteRefreshBudget("initial")).toBe(false);
    expect(usesWebsiteRefreshBudget("retry_failed")).toBe(false);
  });
});

describe("websiteReimportAvailableAt", () => {
  it("returns only a future valid cooldown", () => {
    const now = Date.parse("2026-08-14T12:00:00Z");
    expect(
      websiteReimportAvailableAt(
        { reimportAvailableAt: "2026-08-15T12:00:00Z" },
        now,
      )?.toISOString(),
    ).toBe("2026-08-15T12:00:00.000Z");
    expect(
      websiteReimportAvailableAt(
        { reimportAvailableAt: "2026-08-14T11:59:59Z" },
        now,
      ),
    ).toBeNull();
    expect(websiteReimportAvailableAt({}, now)).toBeNull();
  });
});

describe("lastmodUnchanged", () => {
  it("skips only when both lastmods parse and match", () => {
    expect(lastmodUnchanged("2026-01-02", "2026-01-02")).toBe(true);
    expect(lastmodUnchanged("2026-01-02T00:00:00Z", "2026-01-02")).toBe(true);
    expect(lastmodUnchanged("2026-01-02", "2026-02-01")).toBe(false);
    expect(lastmodUnchanged(null, "2026-01-02")).toBe(false);
    expect(lastmodUnchanged("2026-01-02", null)).toBe(false);
    expect(lastmodUnchanged("not-a-date", "2026-01-02")).toBe(false);
  });
});

describe("documentsToRemove", () => {
  it("drops paths that are no longer selected and keeps nulls out", () => {
    expect(
      documentsToRemove(["/", "/pricing", "/old", null], ["/", "/pricing"]),
    ).toEqual(["/old"]);
  });
});

describe("utcYearMonth", () => {
  it("formats UTC year-month", () => {
    expect(utcYearMonth(new Date("2026-08-14T23:00:00Z"))).toBe("2026-08");
  });
});
