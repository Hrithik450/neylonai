"use client";

import React from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

const GREEN = "#0E3228";
const LIME = "#D4F58A";

type CellVal = boolean | string;

const ROWS: {
  label: string;
  neylon: CellVal;
  intercom: CellVal;
  chatbase: CellVal;
}[] = [
  {
    label: "Reactive Q&A",
    neylon: true,
    intercom: true,
    chatbase: true,
  },
  {
    label: "Proactive engagement (teasers, triggers)",
    neylon: "✅ core",
    intercom: "Partial (paid)",
    chatbase: false,
  },
  {
    label: "Lead capture / visitor to lead",
    neylon: "✅ core",
    intercom: "Add-ons",
    chatbase: "Limited",
  },
  {
    label: "Live human handoff to inbox",
    neylon: true,
    intercom: "✅ (pricey)",
    chatbase: "Limited",
  },
  {
    label: "Multi-channel (WhatsApp, Cal.com)",
    neylon: true,
    intercom: "✅ (pricey)",
    chatbase: "Limited",
  },
  {
    label: "No-code install",
    neylon: true,
    intercom: true,
    chatbase: true,
  },
  {
    label: "Entry price",
    neylon: "$19 / mo",
    intercom: "$85 / seat",
    chatbase: "$40 / mo",
  },
];

export function Comparison() {
  return (
    <section
      id="comparison-table"
      className="py-10 sm:py-12 lg:py-20 overflow-hidden"
    >
      {/* Heading — padded both sides */}
      <div className="px-6 sm:px-10 md:px-20 xl:px-28 mb-8 sm:mb-10">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-2 font-medium">
          Comparison
        </p>
        <h2
          className="landing-strong text-2xl md:text-3xl xl:text-4xl leading-tight"
          style={{ color: GREEN }}
        >
          Why choose Neylon AI?
        </h2>
        <p className="text-gray-500 text-base leading-relaxed mt-4 max-w-xl">
          Get a proactive AI assistant that captures leads and engages visitors — without the enterprise price tag.
        </p>
      </div>

      {/* Mobile: left-padded only, bleeds right with 3px buffer. md+: symmetric padding, no bleed */}
      <div
        className="overflow-x-auto [&::-webkit-scrollbar]:hidden pl-6 pr-[3px] py-[3px] sm:pl-10 md:px-20 md:py-2 xl:px-28"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="min-w-[600px]">
          {/* Table card */}
          <div
            className="bg-white rounded-3xl overflow-hidden"
            style={{
              boxShadow:
                "0 2px 0px rgba(0,0,0,0.06), 0 8px 40px rgba(0,0,0,0.08)",
            }}
          >
            {/* Header row */}
            <div className="grid grid-cols-4 border-b border-black/[0.07]">
              <div className="py-5 px-5 md:py-6 md:px-8" />
              {/* Neylon — highlighted */}
              <div
                className="py-5 px-4 md:py-6 md:px-6 flex flex-col items-center justify-center gap-1 border-l border-black/[0.07]"
                style={{ background: "rgba(14,50,40,0.04)" }}
              >
                <span
                  className="landing-strong text-sm md:text-base"
                  style={{ color: GREEN }}
                >
                  Neylon AI
                </span>
              </div>
              <div className="py-5 px-4 md:py-6 md:px-6 flex items-center justify-center border-l border-black/[0.07]">
                <span className="landing-strong text-xs md:text-sm text-gray-500">
                  Intercom
                </span>
              </div>
              <div className="py-5 px-4 md:py-6 md:px-6 flex items-center justify-center border-l border-black/[0.07]">
                <span className="landing-strong text-xs md:text-sm text-gray-500">
                  Chatbase
                </span>
              </div>
            </div>

            {/* Data rows */}
            {ROWS.map((row, i) => (
              <div
                key={row.label}
                className={cn(
                  "grid grid-cols-4",
                  i < ROWS.length - 1 && "border-b border-black/[0.06]",
                )}
              >
                <div className="py-3.5 px-5 md:py-4 md:px-8 flex items-center text-xs md:text-sm text-gray-600 font-medium">
                  {row.label}
                </div>
                <div
                  className="py-3.5 px-4 md:py-4 md:px-6 flex items-center justify-center border-l border-black/[0.07]"
                  style={{ background: "rgba(14,50,40,0.03)" }}
                >
                  <Cell val={row.neylon} highlight />
                </div>
                <div className="py-3.5 px-4 md:py-4 md:px-6 flex items-center justify-center text-center border-l border-black/[0.07]">
                  <Cell val={row.intercom} />
                </div>
                <div className="py-3.5 px-4 md:py-4 md:px-6 flex items-center justify-center text-center border-l border-black/[0.07]">
                  <Cell val={row.chatbase} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Cell({ val, highlight }: { val: CellVal; highlight?: boolean }) {
  if (val === true) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Check
          className="w-4 h-4 flex-shrink-0"
          style={{ color: highlight ? GREEN : "#16a34a" }}
          strokeWidth={2.5}
        />
      </span>
    );
  }
  if (val === false) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <X className="w-4 h-4 flex-shrink-0 text-red-400" strokeWidth={2.5} />
      </span>
    );
  }
  
  if (typeof val === "string" && val.startsWith("✅")) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium" style={{ color: highlight ? GREEN : "inherit" }}>
        <Check
          className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0"
          style={{ color: highlight ? GREEN : "#16a34a" }}
          strokeWidth={2.5}
        />
        {val.replace("✅", "").trim()}
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.7rem] sm:text-[0.8rem] text-gray-500 font-medium">
      {val}
    </span>
  );
}
