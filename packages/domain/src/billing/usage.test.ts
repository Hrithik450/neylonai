import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  MODEL_PRICE_BOOK,
  getModelPrice,
  modelCostMicros,
  toolCostMicros,
} from "./pricing";

describe("modelCostMicros", () => {
  it("prices gemini-3.6-flash from verified rates", () => {
    const r = modelCostMicros({
      modelId: "gemini-3.6-flash",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(r.pricingStatus).toBe("verified");
    expect(r.costMicros).toBe(9_000_000);
  });

  it("uses different rates per model", () => {
    const flash = modelCostMicros({
      modelId: "gemini-3.5-flash",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    const lite = modelCostMicros({
      modelId: "gemini-3.5-flash-lite",
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(flash.costMicros).toBe(10_500_000);
    expect(lite.costMicros).toBe(2_800_000);
  });

  it("uses audio input rate when modality is audio", () => {
    const text = modelCostMicros({
      modelId: "gemini-3.1-flash-lite",
      inputTokens: 1_000_000,
      outputTokens: 0,
      inputModality: "text",
    });
    const audio = modelCostMicros({
      modelId: "gemini-3.1-flash-lite",
      inputTokens: 1_000_000,
      outputTokens: 0,
      inputModality: "audio",
    });
    expect(text.costMicros).toBe(250_000);
    expect(audio.costMicros).toBe(500_000);
  });

  it("prices embeddings on input only", () => {
    const r = modelCostMicros({
      modelId: "gemini-embedding-001",
      inputTokens: 2_000_000,
      outputTokens: 999,
    });
    expect(r.costMicros).toBe(300_000);
  });

  it("returns unknown for unlisted models", () => {
    const r = modelCostMicros({
      modelId: "not-a-real-model",
      inputTokens: 100,
      outputTokens: 100,
    });
    expect(r.pricingStatus).toBe("unknown");
    expect(r.costMicros).toBeNull();
    expect(getModelPrice("not-a-real-model")).toBeNull();
  });

  it("requires a pricing source on every catalog entry", () => {
    for (const entry of Object.values(MODEL_PRICE_BOOK)) {
      expect(entry.source).toContain("ai.google.dev");
      expect(entry.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

describe("toolCostMicros", () => {
  it("charges 1 Tavily credit at PAYG", () => {
    delete process.env.TAVILY_USD_PER_CREDIT;
    const r = toolCostMicros({ toolId: "tavily.search", operation: "basic" });
    expect(r.quantity).toBe(1);
    expect(r.costMicros).toBe(8_000);
  });

  it("charges 2 credits for advanced", () => {
    delete process.env.TAVILY_USD_PER_CREDIT;
    const r = toolCostMicros({
      toolId: "tavily.search",
      operation: "advanced",
    });
    expect(r.quantity).toBe(2);
    expect(r.costMicros).toBe(16_000);
  });

  it("honors TAVILY_USD_PER_CREDIT", () => {
    process.env.TAVILY_USD_PER_CREDIT = "0.005";
    const r = toolCostMicros({ toolId: "tavily.search", operation: "basic" });
    expect(r.costMicros).toBe(5_000);
    delete process.env.TAVILY_USD_PER_CREDIT;
  });

  it("charges Firecrawl page credit at Hobby effective rate", () => {
    delete process.env.FIRECRAWL_USD_PER_CREDIT;
    const r = toolCostMicros({ toolId: "firecrawl.scrape", operation: "page" });
    expect(r.quantity).toBe(1);
    expect(r.costMicros).toBe(3_200);
  });

  it("meters Jina Reader as free ($0)", () => {
    const r = toolCostMicros({ toolId: "jina.reader", operation: "page" });
    expect(r.quantity).toBe(1);
    expect(r.costMicros).toBe(0);
    expect(r.pricingStatus).toBe("verified");
  });

  it("returns unknown for unlisted tools", () => {
    const r = toolCostMicros({
      toolId: "hubspot.create_contact",
      operation: "create",
    });
    expect(r.pricingStatus).toBe("unknown");
    expect(r.costMicros).toBeNull();
  });
});

const { insert, insertValues } = vi.hoisted(() => {
  const insertValues = vi.fn(async () => undefined);
  const insert = vi.fn(() => ({ values: insertValues }));
  return { insert, insertValues };
});

vi.mock("@neylonai/database", () => ({
  db: { insert },
  usageEvents: {},
  productUsageEvents: {},
}));

import { extractTokenUsage, recordModelUsage, recordToolUsage } from "./usage";

describe("record usage", () => {
  beforeEach(() => {
    insert.mockClear();
    insertValues.mockClear();
  });

  it("requires org and request attribution", async () => {
    await expect(
      recordModelUsage({
        organizationId: "",
        requestId: "r1",
        modelId: "gemini-3.6-flash",
        inputTokens: 1,
      }),
    ).rejects.toThrow(/organizationId/);
    await expect(
      recordModelUsage({
        organizationId: "org",
        requestId: "",
        modelId: "gemini-3.6-flash",
        inputTokens: 1,
      }),
    ).rejects.toThrow(/requestId/);
  });

  it("records model COGS with attribution", async () => {
    await recordModelUsage({
      organizationId: "org-a",
      requestId: "req-1",
      agentId: "default",
      modelId: "gemini-3.6-flash",
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-a",
        request_id: "req-1",
        service: "gemini-3.6-flash",
        provider_cost_micros: 1_500_000,
        pricing_status: "verified",
      }),
    );
  });

  it("isolates organizations", async () => {
    await recordModelUsage({
      organizationId: "org-b",
      requestId: "req-2",
      modelId: "gemini-3.6-flash",
      inputTokens: 10,
    });
    expect(insertValues.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({ organization_id: "org-b" }),
    );
  });

  it("leaves cost null when forceUnknownPricing", async () => {
    await recordModelUsage({
      organizationId: "org-a",
      requestId: "req-3",
      modelId: "gemini-embedding-001",
      inputTokens: 100,
      forceUnknownPricing: true,
    });
    expect(insertValues.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        provider_cost_micros: null,
        pricing_status: "unknown",
      }),
    );
  });

  it("records tool quantity and cost", async () => {
    delete process.env.TAVILY_USD_PER_CREDIT;
    await recordToolUsage({
      organizationId: "org-a",
      requestId: "req-4",
      toolId: "tavily.search",
      operation: "basic",
    });
    expect(insertValues.mock.calls.at(-1)?.[0]).toEqual(
      expect.objectContaining({
        resource_type: "tool",
        quantity: "1",
        provider_cost_micros: 8_000,
      }),
    );
  });

  it("extracts LangChain token usage", () => {
    expect(
      extractTokenUsage({
        usage_metadata: { input_tokens: 12, output_tokens: 34 },
      }),
    ).toEqual({ inputTokens: 12, outputTokens: 34 });
  });

  it("extracts @google/generative-ai usageMetadata", () => {
    expect(
      extractTokenUsage({
        usageMetadata: {
          promptTokenCount: 640,
          candidatesTokenCount: 18,
        },
      }),
    ).toEqual({ inputTokens: 640, outputTokens: 18 });
  });
});
