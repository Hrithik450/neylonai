"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { useSessionView } from "@/components/session-view";
import { useSessionStore } from "@/store/session-store";

const GREEN = "#0E3228";
const SPOT_PAD = 10;

interface BtnRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function OnboardingOverlay() {
  const { user, isAuthenticated } = useSessionView();
  const setUser = useSessionStore((state) => state.setUser);
  const [visible, setVisible] = useState(false);
  const [rect, setRect] = useState<BtnRect | null>(null);

  const measure = useCallback(() => {
    const el = document.getElementById("hero-dashboard-btn");
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  useEffect(() => {
    // Hide as soon as the live row (or a later /api/v1/me refresh) says
    // onboarded — the session cookie alone can still say false after dismiss.
    if (!isAuthenticated || !user || user.has_been_onboarded) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!visible) return;
    // The hero CTA slides in under Framer Motion, so a single delayed read
    // lands mid-animation and leaves the spotlight offset. Follow it instead
    // and stop once the box holds still.
    let frame = 0;
    let raf = 0;
    let lastTop: number | null = null;
    let steady = 0;

    const follow = () => {
      const el = document.getElementById("hero-dashboard-btn");
      const top = el?.getBoundingClientRect().top ?? null;
      measure();
      steady = top !== null && top === lastTop ? steady + 1 : 0;
      lastTop = top;
      frame += 1;
      if (steady < 3 && frame < 90) raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [visible, measure]);

  const dismiss = useCallback(async () => {
    setVisible(false);
    if (user) setUser({ ...user, has_been_onboarded: true });
    try {
      // keepalive: the hero CTA navigates away as this fires.
      await fetch("/api/v1/onboarding/dismiss", {
        method: "POST",
        credentials: "include",
        keepalive: true,
      });
    } catch (err) {
      console.error("Failed to mark onboarding as seen:", err);
    }
  }, [user, setUser]);

  // Taking the spotlighted hero CTA continues into the dashboard tour, so it
  // only closes this overlay — marking onboarding complete here would suppress
  // every dashboard step.
  useEffect(() => {
    if (!visible) return;
    const el = document.getElementById("hero-dashboard-btn");
    if (!el) return;
    const proceed = () => setVisible(false);
    el.addEventListener("click", proceed);
    return () => el.removeEventListener("click", proceed);
  }, [visible, rect]);

  if (!visible || !rect) return null;

  const spotTop = rect.top - SPOT_PAD;
  const spotLeft = rect.left - SPOT_PAD;
  const spotWidth = rect.width + SPOT_PAD * 2;
  const spotHeight = rect.height + SPOT_PAD * 2;
  const spotBR = spotHeight / 2;

  const tipCenterX = Math.max(
    148,
    Math.min(rect.left + rect.width / 2, window.innerWidth - 148),
  );
  const tipTop = rect.top + rect.height + SPOT_PAD + 18;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.22 }}
    >
      {/* backdrop — four panels around the spotlight so the hero CTA below it
          keeps receiving clicks; clicking any panel dismisses */}
      {[
        { top: 0, left: 0, right: 0, height: Math.max(spotTop, 0) },
        { top: spotTop + spotHeight, left: 0, right: 0, bottom: 0 },
        { top: spotTop, left: 0, width: Math.max(spotLeft, 0), height: spotHeight },
        { top: spotTop, left: spotLeft + spotWidth, right: 0, height: spotHeight },
      ].map((style, i) => (
        <div
          key={i}
          className="fixed z-[200] cursor-default"
          style={style}
          onClick={dismiss}
        />
      ))}

      {/* spotlight with box-shadow backdrop */}
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

      {/* tooltip */}
      <div
        className="fixed z-[202] w-[272px] pointer-events-auto"
        style={{ top: tipTop, left: tipCenterX, transform: "translateX(-50%)" }}
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
            className="absolute top-3.5 right-3.5 p-1 rounded-full cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={dismiss}
            aria-label="Dismiss onboarding"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>

          <p
            className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
            style={{ color: GREEN }}
          >
            You&apos;re all set
          </p>
          <h3 className="text-sm font-semibold text-gray-800 mb-2 pr-5 leading-snug">
            Explore your dashboard
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            Connect your knowledge base, customize your widget, and go live —
            takes less than an hour.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
