import { beforeEach, describe, expect, it, vi } from "vitest";

/** Minimal in-memory Storage stand-in (tests run in the node environment). */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, String(value));
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
    clear: () => map.clear(),
    key: (index: number) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

let localStore: Storage = memoryStorage();
let sessionStore: Storage = memoryStorage();

/** Fresh browser globals; `sessionStore` is the per-tab half. */
function installBrowserGlobals(options: { newTab?: boolean } = {}) {
  localStore = options.newTab ? localStore : memoryStorage();
  sessionStore = memoryStorage();
  vi.stubGlobal("window", {
    localStorage: localStore,
    sessionStorage: sessionStore,
  });
  vi.stubGlobal("localStorage", localStore);
  vi.stubGlobal("sessionStorage", sessionStore);
  vi.stubGlobal("document", { cookie: "" });
}

/** Re-importing after resetModules models a page reload. */
async function reload() {
  vi.resetModules();
  return import("./persistence");
}

describe("proactive session budget", () => {
  beforeEach(() => {
    installBrowserGlobals();
    vi.resetModules();
  });

  it("reports a brand-new tab session as new", async () => {
    const { loadProactiveState } = await import("./persistence");
    const { state, isNewSession } = loadProactiveState();

    expect(isNewSession).toBe(true);
    expect(state.sessionSuggestionCount).toBe(0);
    expect(state.pendingOnDemand).toBe(false);
  });

  it("keeps the spent budget across a reload of the same tab", async () => {
    const first = await import("./persistence");
    const { state } = first.loadProactiveState();
    first.saveProactiveState({ ...state, sessionSuggestionCount: 7 });

    const after = (await reload()).loadProactiveState();

    expect(after.isNewSession).toBe(false);
    expect(after.state.sessionSuggestionCount).toBe(7);
  });

  it("does not refund the budget when the cap is already spent", async () => {
    const first = await import("./persistence");
    const { state } = first.loadProactiveState();
    first.saveProactiveState({ ...state, sessionSuggestionCount: 10 });

    const reloaded = await reload();
    const after = reloaded.loadProactiveState();

    expect(reloaded.sessionBudgetRemaining(after.state)).toBe(0);
  });

  it("carries a pending on-demand credit across a reload", async () => {
    const first = await import("./persistence");
    const { state } = first.loadProactiveState();
    first.saveProactiveState({
      ...state,
      sessionSuggestionCount: 10,
      pendingOnDemand: true,
    });

    const after = (await reload()).loadProactiveState();

    expect(after.state.pendingOnDemand).toBe(true);
  });

  it("starts a fresh budget in a new tab but keeps visitor history", async () => {
    const first = await import("./persistence");
    const { state } = first.loadProactiveState();
    first.saveProactiveState({
      ...state,
      shownIds: ["welcome", "abc123"],
      hasVisitedBefore: true,
      sessionSuggestionCount: 9,
    });

    installBrowserGlobals({ newTab: true });
    const newTab = await reload();
    const after = newTab.loadProactiveState();

    expect(after.isNewSession).toBe(true);
    expect(after.state.sessionSuggestionCount).toBe(0);
    expect(after.state.hasVisitedBefore).toBe(true);
    expect(after.state.shownIds).toContain("abc123");
  });

  it("never writes the session budget to localStorage", async () => {
    const { loadProactiveState, saveProactiveState } = await import(
      "./persistence"
    );
    const { state } = loadProactiveState();
    saveProactiveState({ ...state, sessionSuggestionCount: 4 });

    const visitorBlobs = [...Array(localStore.length).keys()]
      .map((i) => localStore.key(i))
      .filter((key): key is string => Boolean(key))
      .map((key) => localStore.getItem(key) ?? "");

    expect(visitorBlobs.length).toBeGreaterThan(0);
    for (const blob of visitorBlobs) {
      expect(blob).not.toContain("sessionSuggestionCount");
    }
  });
});

describe("countsTowardSessionLimit", () => {
  it("charges page, knowledge and welcome bubbles to the cap", async () => {
    const { countsTowardSessionLimit } = await import("./persistence");

    expect(countsTowardSessionLimit("page")).toBe(true);
    expect(countsTowardSessionLimit("knowledge")).toBe(true);
    expect(countsTowardSessionLimit("welcome")).toBe(true);
    expect(countsTowardSessionLimit("welcome_back")).toBe(true);
  });

  it("exempts the on-demand bubble earned by chatting", async () => {
    const { countsTowardSessionLimit } = await import("./persistence");

    expect(countsTowardSessionLimit("recent_conversation")).toBe(false);
  });
});
