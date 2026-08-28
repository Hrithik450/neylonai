/** Built-in generic proactive fallbacks (up to 20 suggestions each). */

export const PAGE_SUGGESTION_LIMIT = 20;

const HOME_PAGE_SUGGESTIONS = [
  "How can I help you today? 👋",
  "Need help finding anything? 🤔",
  "What brings you here today? 👀",
  "Have a question? Just ask! 💬",
  "Looking for something specific? 🔍",
  "I'm here if you need any assistance! ✨",
] as const;

const PAGE_WELCOME_MESSAGES: Record<string, readonly string[]> = {};

const GENERIC_WELCOME_MESSAGES = [
  "Hey there — welcome! 👋",
  "Glad you stopped by! ✨",
  "Welcome — take a look around! 😊",
  "Hi! Nice to see you here 👋",
] as const;

export const WELCOME_BACK_MESSAGES = [
  "Welcome back! 👋",
  "Good to see you again! ✨",
  "Welcome back — pick up where you left off! 😊",
  "Hey again — glad you're back! 👋",
] as const;

function normalizePagePath(pagePath?: string | null): string {
  const trimmed = pagePath?.trim() || "/";
  if (trimmed === "/") return "/";
  return `/${trimmed.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

export function getBuiltInPageSuggestions(pagePath?: string | null): string[] {
  return [...HOME_PAGE_SUGGESTIONS].slice(0, PAGE_SUGGESTION_LIMIT);
}

export function getBuiltInPageWelcomeMessages(
  pagePath?: string | null,
): readonly string[] {
  const path = normalizePagePath(pagePath);
  return PAGE_WELCOME_MESSAGES[path] ?? GENERIC_WELCOME_MESSAGES;
}
