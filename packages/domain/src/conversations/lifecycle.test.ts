import { describe, expect, it } from "vitest";
import { canAiRespond } from "./service";

describe("conversation lifecycle AI gate", () => {
  it.each([
    ["ai_active", true],
    ["resolved", true],
    ["awaiting_contact", false],
    ["human_pending", false],
    ["human_active", false],
  ] as const)("maps %s to canAiRespond=%s", (status, expected) => {
    expect(canAiRespond(status)).toBe(expected);
  });
});
