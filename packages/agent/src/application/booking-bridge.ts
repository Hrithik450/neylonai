/**
 * Support orchestrator bridge for booking.
 * Detects intent, asks confirmation, then delegates to Booking Agent when enabled.
 */

export type BookingBridgePhase =
  | "none"
  | "ask_confirm"
  | "confirmed"
  | "declined";

const BOOKING_INTENT_RE =
  /\b(book|schedule|reschedule|calendly|cal\.com|appointment|demo\s*(call|meeting)?|set\s*up\s*a\s*(call|meeting|demo)|meeting\s*with)\b/i;

const CONFIRM_RE =
  /^(yes|yeah|yep|yup|sure|ok|okay|please|go ahead|confirm|book it|let'?s (do|book)|sounds good|absolutely|definitely)\b/i;

const DECLINE_RE =
  /^(no|nope|nah|not now|cancel|never\s*mind|no thanks|don'?t)\b/i;

const CONFIRM_PROMPT_RE =
  /would you like me to (help you )?book|shall i (help you )?book|want me to (proceed|book|schedule)/i;

export function detectBookingBridgePhase(
  userInput: string,
  conversationHistory: Array<{ role: string; content: string }>,
): BookingBridgePhase {
  const trimmed = userInput.trim();
  if (!trimmed) return "none";

  const lastAssistant = [...conversationHistory]
    .reverse()
    .find((m) => m.role === "assistant" && m.content?.trim());

  const awaitingConfirm = Boolean(
    lastAssistant && CONFIRM_PROMPT_RE.test(lastAssistant.content),
  );

  if (awaitingConfirm) {
    if (CONFIRM_RE.test(trimmed)) return "confirmed";
    if (DECLINE_RE.test(trimmed)) return "declined";
  }

  if (BOOKING_INTENT_RE.test(trimmed)) {
    return "ask_confirm";
  }

  return "none";
}

export const BOOKING_CONFIRM_MESSAGE =
  "I can help you book a meeting. Would you like me to book that for you now?";

export const BOOKING_DECLINED_MESSAGE =
  "No problem — we can skip booking for now. How else can I help?";

export const BOOKING_UNAVAILABLE_MESSAGE =
  "Booking isn’t available for this workspace right now. Please contact the team directly, or ask for a human and we’ll follow up.";
