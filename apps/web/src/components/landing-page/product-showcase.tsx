"use client";

import React from "react";
import Image from "next/image";

const GREEN = "#0E3228";

/**
 * Product demo video shown inside the laptop screen.
 * Drop the file in `apps/web/public/videos/` and set this to its path
 * (e.g. "/videos/product-demo.mp4") to swap the placeholder for the real clip.
 */
const DEMO_VIDEO_SRC: string | null = null;
/** Poster frame shown before the video plays. */
const DEMO_VIDEO_POSTER = "/images/dashboard-overview.png";

export function ProductShowcase() {
  return (
    <section
      id="product-showcase"
      className="py-10 sm:py-12 lg:py-20 px-6 sm:px-10 md:px-20 lg:px-28"
    >
      {/* Heading — proactive suggestions is the lead engine */}
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-2 font-medium">
          Proactive Suggestions
        </p>
        <h2
          className="landing-strong text-2xl md:text-3xl xl:text-4xl leading-tight"
          style={{ color: GREEN }}
        >
          Watch a visitor become a lead.
        </h2>
        <p className="text-gray-500 text-base leading-relaxed mt-4">
          The teaser bubbles above your chat launcher pull passive visitors into
          a conversation — and Neylon turns that conversation into a qualified
          lead.
        </p>
      </div>

      {/* Laptop frame with product video (placeholder until the clip is added) */}
      <div className="relative mx-auto mt-10 w-full max-w-5xl sm:mt-12">
        <div
          className="absolute overflow-hidden"
          style={{
            top: "9.47%",
            left: "10.35%",
            right: "10.35%",
            bottom: "15.92%",
            borderRadius: "2px",
            zIndex: 0,
          }}
        >
          {DEMO_VIDEO_SRC ? (
            <video
              src={DEMO_VIDEO_SRC}
              poster={DEMO_VIDEO_POSTER}
              autoPlay
              loop
              muted
              playsInline
              preload="none"
              className="h-full w-full object-cover object-top"
            />
          ) : (
            <div
              className="flex h-full w-full flex-col items-center justify-center gap-3 text-gray-300"
              style={{ background: "#1a1a1a" }}
            >
              <span
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 56,
                  height: 56,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  aria-hidden="true"
                >
                  <path d="M7 5l8 5-8 5V5z" fill="currentColor" />
                </svg>
              </span>
              <span className="text-xs tracking-wide sm:text-sm">
                Product demo — coming soon
              </span>
            </div>
          )}
        </div>
        <Image
          src="/images/laptop-frame.png"
          alt="Neylon AI product demo"
          width={1536}
          height={1024}
          sizes="(max-width: 1024px) 90vw, 1024px"
          className="relative z-10 h-auto w-full"
        />
      </div>
    </section>
  );
}
