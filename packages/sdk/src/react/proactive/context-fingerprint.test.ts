import { describe, expect, it } from "vitest";
import {
  hasUnreadConversationContext,
  messageContextFingerprint,
} from "./context-fingerprint";

describe("context fingerprint", () => {
  it("returns null when there are no user messages", () => {
    expect(
      messageContextFingerprint([
        { role: "assistant", content: "Hello there" },
      ]),
    ).toBeNull();
  });

  it("detects unread conversation context", () => {
    const messages = [
      { role: "user", content: "How does pricing work?" },
      { role: "assistant", content: "Plans start at $19/mo." },
    ];
    const fingerprint = messageContextFingerprint(messages);
    expect(fingerprint).toContain("pricing");
    expect(hasUnreadConversationContext(messages, null)).toBe(true);
    expect(hasUnreadConversationContext(messages, fingerprint)).toBe(false);
  });
});
