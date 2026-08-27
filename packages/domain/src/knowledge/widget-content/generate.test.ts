import { describe, expect, it } from "vitest";
import {
  parseWidgetContentJson,
  validateWidgetContent,
  type WidgetContentDraft,
} from "./generate";

describe("parseWidgetContentJson", () => {
  it("extracts a JSON object embedded in prose or fences", () => {
    const raw = 'Here you go:\n```json\n{"askTitle":"Ask us"}\n```';
    expect(parseWidgetContentJson(raw)).toEqual({ askTitle: "Ask us" });
  });

  it("returns null for non-JSON text", () => {
    expect(parseWidgetContentJson("no json here")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(parseWidgetContentJson("{ askTitle: unquoted }")).toBeNull();
  });
});

describe("validateWidgetContent", () => {
  it("returns null for non-objects", () => {
    expect(validateWidgetContent(null)).toBeNull();
    expect(validateWidgetContent("nope")).toBeNull();
    expect(validateWidgetContent(42)).toBeNull();
  });

  it("returns null for an empty object (nothing groundable)", () => {
    expect(validateWidgetContent({})).toBeNull();
  });

  it("keeps only well-formed fields and drops empties", () => {
    const draft = validateWidgetContent({
      welcomeGreeting: "  Welcome {name}  ",
      askTitle: "",
      feedbackTitle: "Talk to us",
      unknownField: "ignored",
    });
    expect(draft).toEqual<WidgetContentDraft>({
      welcomeGreeting: "Welcome {name}",
      feedbackTitle: "Talk to us",
    });
  });

  it("caps intro messages at 3 and trims each", () => {
    const draft = validateWidgetContent({
      introMessages: [" a ", "b", "c", "d", "e"],
    });
    expect(draft?.introMessages).toEqual(["a", "b", "c"]);
  });

  it("de-dupes suggested questions (case-insensitive) and caps at 4", () => {
    const draft = validateWidgetContent({
      suggestedQuestions: [
        "How do I start?",
        "how do I start?",
        "What is included?",
        "Do you offer support?",
        "How does it work?",
        "One too many?",
      ],
    });
    expect(draft?.suggestedQuestions).toEqual([
      "How do I start?",
      "What is included?",
      "Do you offer support?",
      "How does it work?",
    ]);
  });

  it("caps faqs at 4 and drops entries missing question or answer", () => {
    const draft = validateWidgetContent({
      faqs: [
        { question: "Q1", answer: "A1" },
        { question: "Q2", answer: "" },
        { question: "", answer: "A3" },
        { question: "Q4", answer: "A4" },
        { question: "Q5", answer: "A5" },
        { question: "Q6", answer: "A6" },
        "not-an-object",
      ],
    });
    expect(draft?.faqs).toEqual([
      { question: "Q1", answer: "A1" },
      { question: "Q4", answer: "A4" },
      { question: "Q5", answer: "A5" },
      { question: "Q6", answer: "A6" },
    ]);
  });

  it("hard-caps overlong strings", () => {
    const long = "x".repeat(500);
    const draft = validateWidgetContent({
      askTitle: long,
      faqs: [{ question: long, answer: long }],
    });
    expect(draft?.askTitle?.length).toBe(60);
    expect(draft?.faqs?.[0]?.question.length).toBe(120);
    expect(draft?.faqs?.[0]?.answer.length).toBe(360);
  });
});
