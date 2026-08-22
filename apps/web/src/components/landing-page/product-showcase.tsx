"use client";

import React, { useState } from "react";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const GREEN = "#0E3228";

const TABS = [
  {
    id: "overview",
    label: "Overview",
    title: "See everything at a glance",
    description:
      "A live summary of how visitors are engaging with your site conversations, response quality, and the moments that matter most.",
    dashboardImage: "/images/dashboard-overview.png",
  },

  {
    id: "widget",
    label: "Widget",
    title: "Looks like it belongs on your site",
    description:
      "Customize colors, fonts, logo, and tone to match your brand exactly. No developer needed.",
    dashboardImage: "/images/dashboard-widget.png",
  },
  {
    id: "conversations",
    label: "Conversations",
    title: "Every conversation, one place",
    description:
      "All your chat threads, escalations, and replies in a single inbox. No missed messages, no switching tabs.",
    dashboardImage: "/images/dashboard-conversations.png",
  },

  {
    id: "integrations",
    label: "Integrations",
    title: "Stay notified without babysitting it",
    description:
      "Get Slack or email alerts the moment a visitor needs a human. Connect to the tools your team already uses.",
    dashboardImage: "/images/dashboard-integrations.png",
  },
  {
    id: "agents",
    label: "AI Agents",
    title: "AI that knows your business",
    description:
      "Set up a chat assistant trained on your own content. It answers questions accurately and hands off to your team when needed.",
    dashboardImage: "/images/dashboard-agents.png",
  },
];

export function ProductShowcase() {
  const [activeTab, setActiveTab] = useState("overview");
  const active = TABS.find((t) => t.id === activeTab)!;

  return (
    <section
      id="product-showcase"
      className="py-10 sm:py-12 lg:py-20 px-6 sm:px-10 md:px-20 lg:px-28"
    >
      {/* Main layout */}
      <div className="flex flex-col lg:flex-row items-start gap-10">
        {/* Left: tab list */}
        <div className="relative flex-none w-full lg:w-52">
          <div
            className="flex flex-row lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none" }}
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-none text-left px-4 py-2.5 rounded-xl text-sm font-medium transition-all whitespace-nowrap cursor-pointer",
                  activeTab === tab.id
                    ? "text-white"
                    : "text-gray-500 hover:text-gray-800 hover:bg-black/5",
                )}
                style={activeTab === tab.id ? { background: GREEN } : {}}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {/* Scroll hint — mobile only */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-10 bg-gradient-to-l from-white to-transparent flex items-center justify-end lg:hidden">
            <ChevronRight className="w-4 h-4 text-gray-400 animate-[nudge_1.4s_ease-in-out_infinite]" />
          </div>
        </div>

        {/* Right: description + device mockup — capped + centered on tablet, free on desktop */}
        <div className="flex-1 min-w-0 w-full md:max-w-2xl md:mx-auto lg:max-w-none lg:mx-0">
          {/* Description */}
          <div className="mb-8">
            <h3
              className="landing-strong text-2xl md:text-3xl mb-2"
              style={{ color: GREEN }}
            >
              {active.title}
            </h3>
            <p className="text-gray-500 text-base leading-relaxed max-w-lg">
              {active.description}
            </p>
          </div>

          {/* Device frames — laptop + phone stacked */}
          <div className="relative w-full lg:-ml-[8%] lg:-mt-[3%]">
            {/* Laptop */}
            <div className="relative w-full">
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
                {active.dashboardImage ? (
                  <Image
                    src={active.dashboardImage}
                    alt={active.title}
                    fill
                    sizes="(max-width: 1024px) 80vw, 560px"
                    className="object-cover object-top"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-sm text-gray-400"
                    style={{ background: "#1a1a1a" }}
                  >
                    {active.label} screenshot coming soon
                  </div>
                )}
              </div>
              <Image
                src="/images/laptop-frame.png"
                alt="Dashboard"
                width={1536}
                height={1024}
                sizes="(max-width: 1024px) 90vw, 640px"
                className="w-full h-auto relative z-10"
              />
            </div>

            {/* iPhone — absolutely positioned at bottom-right of laptop */}
            <div
              className="absolute"
              style={{
                width: "34%",
                right: "-8%",
                bottom: "0%",
                zIndex: 20,
              }}
            >
              <div
                className="absolute overflow-hidden"
                style={{
                  top: "2.4%",
                  left: "19.3%",
                  right: "19.4%",
                  bottom: "4.1%",
                  borderRadius: "6%",
                  zIndex: 0,
                }}
              >
                <Image
                  src="/images/widget-preview.png"
                  alt="Support widget"
                  fill
                  sizes="(max-width: 1024px) 30vw, 220px"
                  loading="lazy"
                  className="object-fill"
                />
              </div>
              <Image
                src="/images/iphone-frame.png"
                alt="Support widget on phone"
                width={1034}
                height={1521}
                sizes="(max-width: 1024px) 30vw, 220px"
                loading="lazy"
                className="w-full h-auto relative z-10"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
