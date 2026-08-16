import type { ProactiveTriggerType } from "../../proactive-triggers";
import { getOrCreateVisitorId } from "../../visitor";

const STORAGE_KEY = "neylonai.proactiveTriggerCooldown.v1";

type CooldownMap = Record<string, number>;

function storageKey(visitorId: string): string {
  return `${STORAGE_KEY}.${visitorId}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

function loadCooldowns(visitorId: string): CooldownMap {
  if (!canUseStorage()) return {};
  try {
    const raw = sessionStorage.getItem(storageKey(visitorId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CooldownMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCooldowns(visitorId: string, map: CooldownMap): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(storageKey(visitorId), JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function triggerCooldownKey(
  triggerType: ProactiveTriggerType,
  pagePath: string | null,
  sectionKey?: string | null,
): string {
  return `${triggerType}:${pagePath ?? "/"}:${sectionKey ?? "page"}`;
}

export function hasTriggerCooldownExpired(
  triggerType: ProactiveTriggerType,
  pagePath: string | null,
  cooldownMs: number,
  visitorId = getOrCreateVisitorId(),
  sectionKey?: string | null,
): boolean {
  if (cooldownMs <= 0) return true;
  const key = triggerCooldownKey(triggerType, pagePath, sectionKey);
  const map = loadCooldowns(visitorId);
  const firedAt = map[key];
  if (!firedAt) return true;
  return Date.now() - firedAt >= cooldownMs;
}

export function markTriggerFired(
  triggerType: ProactiveTriggerType,
  pagePath: string | null,
  visitorId = getOrCreateVisitorId(),
  sectionKey?: string | null,
): void {
  const key = triggerCooldownKey(triggerType, pagePath, sectionKey);
  const map = loadCooldowns(visitorId);
  map[key] = Date.now();
  saveCooldowns(visitorId, map);
}

export function isDesktopExitIntentCapable(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer:fine)").matches;
}

export function readScrollDepthPercent(): number {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return 0;
  }
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || 0;
  const viewport = window.innerHeight || doc.clientHeight || 0;
  const height = Math.max(doc.scrollHeight, doc.offsetHeight, doc.clientHeight);
  if (height <= viewport) return 100;
  return Math.min(100, Math.round(((scrollTop + viewport) / height) * 100));
}
