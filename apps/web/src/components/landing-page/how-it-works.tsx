"use client";

import { useRef } from "react";
import Image from "next/image";
import { MoveRight } from "lucide-react";

const GREEN = "#0E3228";

const STEPS = [
  {
    number: 1,
    title: "Install the SDK",
    description:
      "Add the SDK manually or let your coding agent install it using our setup file.",
    illustration: "/images/how-it-works-illustration-1.png",
    accent: "#FF806D",
    iconBackground: "#FFF1EC",
    layerA: { rotate: -6, tx: -4, ty: 2 },
    layerB: { rotate: 5, tx: 4, ty: -2 },
  },
  {
    number: 2,
    title: "Tell it about your business",
    description:
      "Share your website, documents, or FAQs so the assistant learns your business. Configure everything from your dashboard.",
    illustration: "/images/how-it-works-illustration-2.png",
    accent: "#AEEAD6",
    iconBackground: "#EAF9F3",
    layerA: { rotate: -5, tx: -3, ty: -3 },
    layerB: { rotate: 6, tx: 4, ty: 2 },
  },
  {
    number: 3,
    title: "Start engaging visitors",
    description:
      "Your assistant goes live greeting visitors, answering questions, and flagging anything that needs a human.",
    illustration: "/images/how-it-works-illustration-3.png",
    accent: "#C9BDF4",
    iconBackground: "#F1EEFC",
    layerA: { rotate: 6, tx: 3, ty: -2 },
    layerB: { rotate: -5, tx: -4, ty: 3 },
  },
] as const;

function StepCard({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <div className="relative p-4">
      {/* Rear Layer A — anti-clockwise, full height, peeks top & bottom */}
      <div
        aria-hidden="true"
        className="absolute inset-4 rounded-[1.75rem] border-2 border-black/80"
        style={{
          backgroundColor: step.accent,
          transform: `rotate(${step.layerA.rotate}deg) translate(${step.layerA.tx}px, ${step.layerA.ty}px)`,
          zIndex: 0,
        }}
      />

      {/* Rear Layer B — clockwise, shorter height, peeks left & right only */}
      <div
        aria-hidden="true"
        className="absolute rounded-[1.75rem] border-2 border-black/80"
        style={{
          top: 24,
          bottom: 24,
          left: 16,
          right: 16,
          backgroundColor: step.accent,
          transform: `rotate(${step.layerB.rotate}deg) translate(${step.layerB.tx}px, ${step.layerB.ty}px)`,
          zIndex: 1,
        }}
      />

      {/* Foreground white card */}
      <article
        className="relative flex flex-col items-center rounded-[1.75rem] border-2 border-black/80 bg-white px-6 pb-8 pt-7 text-center"
        style={{ zIndex: 2, minHeight: 300 }}
      >
        <div
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-black/10"
          style={{ backgroundColor: step.iconBackground }}
        >
          <Image
            src={step.illustration}
            alt={step.title}
            width={88}
            height={88}
            className="object-contain"
          />
        </div>

        <h3 className="landing-strong text-xl" style={{ color: GREEN }}>
          {step.number}. {step.title}
        </h3>

        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          {step.description}
        </p>
      </article>
    </div>
  );
}

export function HowItWorks() {
  const scrollRef = useRef<HTMLDivElement>(null);

  function scroll(dir: "left" | "right") {
    const container = scrollRef.current;
    if (!container) return;
    const firstCard = container.querySelector<HTMLElement>("[data-step-card]");
    if (!firstCard) return;
    const gap = parseFloat(getComputedStyle(container).gap) || 24;
    const step = firstCard.offsetWidth + gap;
    container.scrollBy({
      left: dir === "right" ? step : -step,
      behavior: "smooth",
    });
  }

  return (
    <section
      id="how-it-works"
      className="overflow-hidden py-12 sm:py-16 lg:py-24"
    >
      <div className="px-6 sm:px-10 md:px-20 lg:px-28">
        {/* Header row — with scroll buttons visible only on sm→lg */}
        <div className="mb-10 flex items-end justify-between sm:mb-14">
          <div className="text-left">
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-gray-400">
              How it works
            </p>
            <h2
              className="landing-strong text-2xl leading-tight md:text-3xl xl:text-4xl"
              style={{ color: GREEN }}
            >
              Up and running in minutes.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-gray-500 sm:text-base">
              No engineering sprint needed. Just add a snippet, share what your
              business does, and you&apos;re live.
            </p>
          </div>

          {/* Scroll arrows — tablet only (sm→lg) */}
          <div className="hidden flex-shrink-0 gap-3 sm:flex lg:hidden">
            <button
              onClick={() => scroll("left")}
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black transition-colors hover:bg-gray-800"
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
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-black transition-colors hover:bg-gray-800"
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
      </div>

      {/* Mobile: vertical stack */}
      <div className="flex flex-col gap-10 px-6 sm:hidden">
        {STEPS.map((step) => (
          <StepCard key={step.number} step={step} />
        ))}
      </div>

      {/* Tablet: horizontal scroll (sm→lg), bleeds to right edge */}
      <div
        ref={scrollRef}
        className="hidden gap-6 overflow-x-auto scroll-smooth pb-4 pl-6 sm:flex sm:pl-10 md:pl-20 lg:hidden"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {STEPS.map((step) => (
          <div
            key={step.number}
            data-step-card
            className="flex-shrink-0"
            style={{ width: "min(360px, 75vw)" }}
          >
            <StepCard step={step} />
          </div>
        ))}
        {/* Trailing spacer mirrors left padding */}
        <div className="w-10 flex-none sm:w-10 lg:w-28" aria-hidden="true" />
      </div>

      {/* Desktop: 3-column grid (lg+) */}
      <div className="hidden px-6 sm:px-10 md:px-20 lg:block lg:px-28">
        <div className="grid grid-cols-3 gap-8 lg:gap-10">
          {STEPS.map((step) => (
            <StepCard key={step.number} step={step} />
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="mt-11 px-6 text-center sm:mt-14 sm:px-10 md:px-20 lg:px-28">
        <a
          href="#footer"
          className="landing-strong inline-flex items-center gap-2 rounded-full border border-black/80 px-7 py-3 text-sm text-white transition-transform hover:-translate-y-0.5"
          style={{
            backgroundColor: "#FF806D",
            boxShadow: "-2px 3px 0 #0E3228",
          }}
        >
          Start engaging your visitors
          <MoveRight aria-hidden="true" className="h-4 w-4" />
        </a>
      </div>
    </section>
  );
}
