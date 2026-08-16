import { describe, expect, it } from "vitest";
import { fitsWebsiteCrawlBudget } from "./budget";
import { websiteRefreshBudgetSettlement } from "./helpers";

describe("monthly crawl refresh reservation", () => {
  it("allows only as many import/refresh runs as the monthly limit", () => {
    const limit = 2;
    const state = { reserved: 0, consumed: 0 };
    const results = [1, 1, 1].map((add) => {
      if (!fitsWebsiteCrawlBudget(state.reserved, state.consumed, add, limit)) {
        return false;
      }
      state.reserved += add;
      return true;
    });
    expect(results).toEqual([true, true, false]);
    expect(state.reserved + state.consumed).toBe(2);
  });

  it("allows another refresh after a cancelled reservation is released", () => {
    const limit = 1;
    let reserved = 1;
    let consumed = 0;
    reserved -= 1;
    expect(fitsWebsiteCrawlBudget(reserved, consumed, 1, limit)).toBe(true);
  });

  it("charges only finished refreshes", () => {
    expect(websiteRefreshBudgetSettlement("completed")).toBe("consume");
    expect(websiteRefreshBudgetSettlement("failed")).toBe("release");
    expect(websiteRefreshBudgetSettlement("cancelled")).toBe("release");
  });

  it("converting a reserved refresh to consumed does not free capacity", () => {
    let reserved = 1;
    let consumed = 0;
    reserved -= 1;
    consumed += 1;
    expect(reserved + consumed).toBe(1);
    expect(fitsWebsiteCrawlBudget(reserved, consumed, 1, 1)).toBe(false);
  });
});
