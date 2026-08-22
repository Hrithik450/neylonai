/** Built-in per-page proactive catalogs (up to 20 suggestions each). */

export const PAGE_SUGGESTION_LIMIT = 20;

const HOME_PAGE_SUGGESTIONS = [
  "Know why visitors leave before they bounce? 👀",
  "Ready to engage visitors at the right moment? 🚀",
  "Curious how proactive AI actually works? ✨",
  "Want support that never sleeps? 💬",
  "Tired of chat widgets that just sit idle? 😤",
  "Is your traffic converting or just passing through? 🤔",
  "Ready to automate the boring stuff? ⚡",
  "What's included in the free plan? 💡",
  "How fast can you launch on your site? 🚀",
  "Curious how Neylon differs from Intercom? 🔥",
  "Want real-time visitor insights? 👀",
  "Still waiting hours for support replies? 💬",
  "Ready to turn traffic into conversations? ✨",
  "How does the AI learn your content? 🤔",
  "Want to see it in action first? 👀",
  "Curious about multi-agent orchestration? ⚡",
  "Does setup really take five minutes? 🚀",
  "Know when a human should step in? 💡",
  "Want answers grounded in your knowledge base? ✨",
  "Ready to stop losing interested visitors? 🔥",
] as const;

const PAGE_WELCOME_MESSAGES: Record<string, readonly string[]> = {
  "/": [
    "Hey — welcome to Neylon AI! 👋",
    "Glad you're here — see what we can do! ✨",
    "Welcome — curious how we engage visitors? 🤔",
    "Hi! Nice to see you on Neylon AI 👋",
  ],
};

const PAGE_CATALOG: Record<string, readonly string[]> = {
  "/": HOME_PAGE_SUGGESTIONS,
};

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
  const path = normalizePagePath(pagePath);
  const catalog = PAGE_CATALOG[path];
  if (catalog?.length) return [...catalog].slice(0, PAGE_SUGGESTION_LIMIT);
  return [...HOME_PAGE_SUGGESTIONS].slice(0, PAGE_SUGGESTION_LIMIT);
}

export function getBuiltInPageWelcomeMessages(
  pagePath?: string | null,
): readonly string[] {
  const path = normalizePagePath(pagePath);
  return PAGE_WELCOME_MESSAGES[path] ?? GENERIC_WELCOME_MESSAGES;
}
