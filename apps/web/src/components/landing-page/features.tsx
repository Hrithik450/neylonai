"use client";

import React, { useRef } from "react";

const GREEN = "#0E3228";

const FEATURES = [
  {
    title: "Start the conversation first",
    description:
      "Neylon reaches out to visitors at the right moment when they're browsing, hesitating, or about to leave so you don't lose them to silence.",
    bg: "#FFF3D6",
    video: "/videos/Chat Message.mp4",
    tag: "Engagement",
  },
  {
    title: "Answer every question, any time",
    description:
      "Your site stays helpful 24/7. Visitors get instant, accurate answers no wait times, no drop-offs, no missed opportunities.",
    bg: "#E8E4FF",
    video: "/videos/AI Robot chatbot.mp4",
    tag: "Support",
  },
  {
    title: "Win back visitors before they're gone",
    description:
      "When someone goes idle or moves toward the exit, Neylon sends a timely nudge to keep them engaged.",
    bg: "#D6F0F5",
    video: "/videos/Notification Bell.mp4",
    tag: "Retention",
  },
  {
    title: "See where visitors drop off",
    description:
      "Find out which pages lose visitors, what questions go unanswered, and which conversations actually convert.",
    bg: "#D6F5E3",
    video: "/videos/Market increase graph hand.mp4",
    cover: true,
    tag: "Analytics",
  },
];

export function Features() {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    const container = scrollRef.current;
    if (!container) return;
    const firstCard = container.querySelector<HTMLElement>(
      "[data-feature-card]",
    );
    if (!firstCard) return;
    const gap = parseFloat(getComputedStyle(container).gap) || 16;
    const step = firstCard.offsetWidth + gap;
    container.scrollBy({
      left: dir === "right" ? step : -step,
      behavior: "smooth",
    });
  }

  return (
    <section id="features" className="py-10 sm:py-12 lg:py-20 overflow-hidden">
      {/* Top row: heading + tag on first line, nav buttons below on mobile */}
      <div className="pl-6 sm:pl-10 md:pl-20 lg:pl-28 pr-6 sm:pr-10 md:pr-20 lg:pr-28 flex flex-col sm:flex-row sm:items-end sm:justify-between mb-10 gap-4 sm:gap-6">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400 mb-2 font-medium">
            Our Features
          </p>
          <h2
            className="landing-strong text-2xl md:text-3xl xl:text-4xl leading-tight"
            style={{ color: GREEN }}
          >
            Catch visitors before
            <br />
            they click away.
          </h2>
        </div>
        <div className="flex gap-3 flex-shrink-0 self-end sm:self-auto">
          <button
            onClick={() => scroll("left")}
            className="w-11 h-11 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Scroll left"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M11 14L6 9L11 4"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-11 h-11 rounded-full bg-black flex items-center justify-center hover:bg-gray-800 transition-colors cursor-pointer"
            aria-label="Scroll right"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M7 4L12 9L7 14"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Scrollable cards — left-aligned with heading, bleeds to the right edge */}
      <div
        ref={scrollRef}
        className="flex gap-4 sm:gap-6 overflow-x-auto scroll-smooth pb-4 pl-6 sm:pl-10 md:pl-20 lg:pl-28"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {FEATURES.map((f) => (
          <div
            key={f.title}
            data-feature-card
            className="flex-shrink-0 rounded-3xl px-6 pt-6 pb-7 flex flex-col"
            style={{
              background: f.bg,
              width: "min(320px, 80vw)",
              boxShadow:
                "0 2px 0px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.07)",
            }}
          >
            <div
              className="mb-7 flex items-center justify-center rounded-2xl overflow-hidden"
              style={{ width: 112, height: 112 }}
            >
              <video
                src={f.video}
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: 112,
                  height: 112,
                  objectFit: f.cover ? "cover" : "contain",
                  mixBlendMode: "multiply",
                  display: "block",
                }}
              />
            </div>
            <h3
              className="landing-strong text-[1.15rem] mb-2.5 tracking-tight"
              style={{ color: GREEN }}
            >
              {f.title}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              {f.description}
            </p>
            <div className="mt-auto pt-5">
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: "rgba(0,0,0,0.07)", color: GREEN }}
              >
                {f.tag}
              </span>
            </div>
          </div>
        ))}
        {/* Trailing spacer — mirrors left padding so last card can rest centered */}
        <div
          className="flex-none w-6 sm:w-10 md:w-20 lg:w-28"
          aria-hidden="true"
        />
      </div>
    </section>
  );
}
