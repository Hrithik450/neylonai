"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { getMe } from "@/lib/neylon-session-api";

const GREEN = "#0E3228";
const SPOT_PAD = 8;
/** Distance between the spotlight edge and the tooltip. */
const TIP_GAP = 12;
/** Minimum breathing room against the viewport edges. */
const VIEWPORT_MARGIN = 12;
const TIP_WIDTH = 296;

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

interface StepDef {
  step: number;
  path: string;
  section?: string;
  targetId: string;
  badge: string;
  title: string;
  description: string;
  cta: string;
  ctaHref?: string;
  total: number;
  /** Scroll target into view before spotlighting */
  scrollFirst?: boolean;
  /** Extra ms to wait before measuring (default 340). Useful for async pages. */
  delayMs?: number;
  /**
   * Selector, scoped to the target, that must exist before measuring. Targets
   * whose shell renders before their fetched content would otherwise be
   * spotlighted while still empty.
   */
  readySelector?: string;
}

const STEPS: StepDef[] = [
  {
    step: 1,
    path: "/dashboard",
    targetId: "overview-metrics-grid",
    badge: "Step 1 of 8",
    title: "Your command center",
    description:
      "These cards show your chatbot status, AI credit balance, proactive engagement, and current plan, everything at a glance.",
    cta: "Next — Create API key",
    ctaHref: "/dashboard/settings?section=api-keys",
    scrollFirst: true,
    total: 8,
  },
  {
    step: 2,
    path: "/dashboard/settings",
    section: "api-keys",
    targetId: "api-keys-card",
    badge: "Step 2 of 8",
    title: "Create your API key",
    description:
      "Generate a publishable key here, paste it into the widget SDK so your site can talk to Neylon.",
    cta: "Next — Install SDK",
    ctaHref: "/dashboard/settings?section=developer",
    total: 8,
  },
  {
    step: 3,
    path: "/dashboard/settings",
    section: "developer",
    targetId: "sdk-mode-options",
    badge: "Step 3 of 8",
    title: "Install the widget",
    description:
      "Choose Manual to copy the SDK snippet, or Install with coding agent for automated SDK and API key setup.",
    cta: "Next — Customize chatbot",
    ctaHref: "/dashboard/widget",
    total: 8,
  },
  {
    step: 4,
    path: "/dashboard/widget",
    targetId: "widget-mode-options",
    badge: "Step 4 of 8",
    title: "Customize your chatbot",
    description:
      "Set name, colors, greeting, and FAQs manually, or switch to Configure with coding agent to match your website's own theme.",
    cta: "Next — Connect knowledge",
    ctaHref: "/dashboard/integrations",
    total: 8,
  },
  {
    step: 5,
    path: "/dashboard/integrations",
    targetId: "integration-website-card",
    badge: "Step 5 of 8",
    title: "Connect your knowledge",
    description:
      "Start with Website, Neylon AI crawls your pages so the chatbot answers from your actual content, not guesses.",
    cta: "Next — Conversations",
    ctaHref: "/dashboard/conversations",
    delayMs: 900,
    total: 8,
  },
  {
    step: 6,
    path: "/dashboard/conversations",
    targetId: "conversations-grid",
    badge: "Step 6 of 8",
    title: "View visitor conversations",
    description:
      "Every chat your visitors have appears here in real time. Filter, search, and jump in as a human when needed.",
    cta: "Next — Usage",
    ctaHref: "/dashboard/usage",
    scrollFirst: true,
    total: 8,
  },
  {
    step: 7,
    path: "/dashboard/usage",
    targetId: "usage-metrics-row",
    badge: "Step 7 of 8",
    title: "Monitor usage",
    description:
      "Track AI credits and conversation volume per billing period. Plan, Used, Remaining, and Conversations, all here.",
    cta: "Next — Billing",
    ctaHref: "/dashboard/settings?section=billing",
    scrollFirst: true,
    total: 8,
  },
  {
    step: 8,
    path: "/dashboard/settings",
    section: "billing",
    targetId: "billing-plans-section",
    badge: "Step 8 of 8",
    title: "Plan & billing",
    description:
      "Pick the plan that fits your volume. Upgrade anytime, credits activate immediately.",
    cta: "Done — I'm all set",
    scrollFirst: true,
    // The plan cards arrive from /api/v1/billing after the section mounts.
    readySelector: "[data-plan-card]",
    total: 8,
  },
];

interface SpotRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface DashboardOnboardingOverlayProps {
  /** Read through to the users row by the server layout, not a cookie snapshot. */
  hasBeenOnboarded: boolean;
  onboardingStep: number;
}

function resolveStep(
  hasBeenOnboarded: boolean,
  onboardingStep: number,
): number | "done" {
  if (
    !hasBeenOnboarded &&
    onboardingStep >= 1 &&
    onboardingStep <= STEPS.length
  ) {
    return onboardingStep;
  }
  return "done";
}

export function DashboardOnboardingOverlay({
  hasBeenOnboarded,
  onboardingStep,
}: DashboardOnboardingOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Soft-nav can serve a stale RSC layout payload; start from props but
  // re-confirm against /api/v1/me (always reads the live users row).
  const [currentStep, setCurrentStep] = useState<number | "done" | null>(null);
  const [rect, setRect] = useState<SpotRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const [tipHeight, setTipHeight] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setCurrentStep(resolveStep(hasBeenOnboarded, onboardingStep));

    (async () => {
      try {
        const me = await getMe();
        if (cancelled || !me.success || !me.user) return;
        setCurrentStep(
          resolveStep(me.user.has_been_onboarded, me.user.onboarding_step),
        );
      } catch (err) {
        console.error("Failed to refresh onboarding state:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasBeenOnboarded, onboardingStep]);

  const stepDef =
    currentStep !== null && currentStep !== "done"
      ? (STEPS.find((s) => s.step === currentStep) ?? null)
      : null;

  const pageMatches = useCallback(
    (def: StepDef) => {
      const pathOk =
        def.path === "/dashboard"
          ? pathname === "/dashboard"
          : pathname.startsWith(def.path);
      if (!pathOk) return false;
      if (def.section) return searchParams.get("section") === def.section;
      return true;
    },
    [pathname, searchParams],
  );

  const measure = useCallback((def: StepDef) => {
    const el = document.getElementById(def.targetId);
    if (!el) {
      setRect(null);
      return false;
    }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setRect(null);
      return false;
    }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    return true;
  }, []);

  useEffect(() => {
    if (!stepDef || !pageMatches(stepDef)) {
      setRect(null);
      return;
    }

    const def = stepDef;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const observers: ResizeObserver[] = [];

    const centerThenMeasure = (el: HTMLElement) => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      timers.push(setTimeout(() => measure(def), 480));
    };

    /**
     * Async panels keep growing after the first measurement (billing loads its
     * plan cards, integrations its provider list), which would leave the
     * spotlight framing an empty shell. Track the target's box instead.
     */
    const track = (el: HTMLElement) => {
      if (typeof ResizeObserver === "undefined") return;
      let lastHeight = el.getBoundingClientRect().height;
      const observer = new ResizeObserver(() => {
        if (cancelled) return;
        const height = el.getBoundingClientRect().height;
        const grew = height - lastHeight > 24;
        lastHeight = height;
        if (grew && def.scrollFirst) {
          centerThenMeasure(el);
          return;
        }
        measure(def);
      });
      observer.observe(el);
      // Content mounting above the target shifts it without resizing it.
      observer.observe(document.body);
      observers.push(observer);
    };

    const settle = (el: HTMLElement) => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(() => {
        if (cancelled) return;
        if (def.scrollFirst) centerThenMeasure(el);
        else measure(def);
        track(el);
      });
    };

    // Dashboard pages hydrate their data client-side, so the target can mount
    // well after the step does. Poll briefly instead of giving up on one miss.
    let elapsed = 0;
    const POLL_MS = 200;
    const MAX_WAIT_MS = 10_000;

    const attempt = () => {
      if (cancelled) return;
      const el = document.getElementById(def.targetId);
      const ready =
        el && (!def.readySelector || el.querySelector(def.readySelector));
      if (el && ready) {
        settle(el);
        return;
      }
      elapsed += POLL_MS;
      if (elapsed >= MAX_WAIT_MS) {
        // Better a spotlight on the shell than none at all.
        if (el) settle(el);
        return;
      }
      timers.push(setTimeout(attempt, POLL_MS));
    };

    timers.push(setTimeout(attempt, def.delayMs ?? 340));

    const onViewportChange = () => measure(def);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, { passive: true });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
      observers.forEach((observer) => observer.disconnect());
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", onViewportChange);
    };
  }, [stepDef, pageMatches, measure]);

  const dismiss = useCallback(async () => {
    setCurrentStep("done");
    setRect(null);

    try {
      await fetch("/api/v1/onboarding/dismiss", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("Failed to mark onboarding as seen:", err);
    }
  }, []);

  const advance = useCallback(async () => {
    if (currentStep === null || currentStep === "done") return;
    const def = STEPS.find((s) => s.step === currentStep);
    if (!def) return;

    if (currentStep >= STEPS.length) {
      // Finished all steps
      setCurrentStep("done");
      setRect(null);

      try {
        await fetch("/api/v1/onboarding/dismiss", {
          method: "POST",
          credentials: "include",
        });
      } catch (err) {
        console.error("Failed to mark onboarding as complete:", err);
      }
      return;
    }

    const nextStep = currentStep + 1;
    setCurrentStep(nextStep);
    setRect(null);

    // Save step to database
    try {
      await fetch("/api/v1/onboarding/step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ step: nextStep }),
      });
    } catch (err) {
      console.error("Failed to save onboarding step:", err);
    }

    if (def.ctaHref) {
      router.push(def.ctaHref);
    }
  }, [currentStep, router]);

  // Measure the rendered card instead of assuming a height — guessing leaves a
  // large gap on short cards, which reads as an unrelated floating panel.
  useIsomorphicLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    setTipHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  });

  const visible = stepDef !== null && pageMatches(stepDef) && rect !== null;

  if (!visible || !rect || !stepDef) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Clamp spotlight to viewport so box-shadow is always clean
  const spotTop = Math.max(0, rect.top - SPOT_PAD);
  const spotLeft = Math.max(0, rect.left - SPOT_PAD);
  const spotWidth = Math.min(rect.width + SPOT_PAD * 2, vw - spotLeft);
  const spotHeight = Math.min(rect.height + SPOT_PAD * 2, vh - spotTop);
  const spotBR = Math.min(spotHeight / 2, 10);
  const spotBottom = spotTop + spotHeight;

  const half = TIP_WIDTH / 2 + VIEWPORT_MARGIN;
  const tipCenterX = Math.max(
    half,
    Math.min(rect.left + rect.width / 2, vw - half),
  );

  const tipH = tipHeight || 240;
  let tipTop: number;
  if (spotBottom + TIP_GAP + tipH <= vh - VIEWPORT_MARGIN) {
    tipTop = spotBottom + TIP_GAP;
  } else if (spotTop - TIP_GAP - tipH >= VIEWPORT_MARGIN) {
    tipTop = spotTop - TIP_GAP - tipH;
  } else {
    // Target is taller than the viewport allows on either side (billing plans,
    // integration list): tuck the card just inside the spotlight's lower edge
    // so it still reads as attached to the highlighted region.
    tipTop = Math.min(
      Math.max(VIEWPORT_MARGIN, spotBottom - tipH - TIP_GAP),
      vh - tipH - VIEWPORT_MARGIN,
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        key={`step-${stepDef.step}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-[200] cursor-default"
          onClick={dismiss}
        />

        {/* Spotlight */}
        <div
          className="fixed z-[201] pointer-events-none"
          style={{
            top: spotTop,
            left: spotLeft,
            width: spotWidth,
            height: spotHeight,
            borderRadius: spotBR,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.52)",
            outline: "2px solid rgba(255,255,255,0.32)",
            outlineOffset: 0,
          }}
        />

        {/* Tooltip */}
        <div
          ref={tipRef}
          className="fixed z-[202] pointer-events-auto"
          style={{
            top: tipTop,
            left: tipCenterX,
            width: TIP_WIDTH,
            transform: "translateX(-50%)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="bg-white rounded-2xl p-5 relative"
            style={{
              boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
              border: "1px solid rgba(0,0,0,0.07)",
            }}
          >
            <button
              className="absolute top-3.5 right-3.5 p-1 rounded-full hover:bg-gray-100 transition-colors"
              onClick={dismiss}
              aria-label="Dismiss onboarding"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>

            <p
              className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
              style={{ color: GREEN }}
            >
              {stepDef.badge}
            </p>

            <h3 className="text-sm font-semibold text-gray-800 mb-2 pr-5 leading-snug">
              {stepDef.title}
            </h3>

            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              {stepDef.description}
            </p>

            {/* Progress dots */}
            <div className="flex items-center gap-1 mb-4">
              {STEPS.map((s) => (
                <div
                  key={s.step}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: s.step === stepDef.step ? 16 : 6,
                    height: 6,
                    background:
                      s.step === stepDef.step
                        ? GREEN
                        : s.step < stepDef.step
                          ? `${GREEN}66`
                          : "#e5e7eb",
                  }}
                />
              ))}
            </div>

            <button
              className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-85"
              style={{ background: GREEN }}
              onClick={advance}
            >
              {stepDef.cta}
              {typeof currentStep === "number" &&
                currentStep < STEPS.length && (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
