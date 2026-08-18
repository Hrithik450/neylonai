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
  { label: "Free plan", neylon: true, intercom: false, chatbase: "Limited" },

  {
    label: "Starting price",
    neylon: "$19 / mo",
    intercom: "$39+ / seat",
    chatbase: "$19 / mo",
  },

  {
    label: "Proactive visitor engagement",
    neylon: true,
    intercom: "Paid add-on",
    chatbase: false,
  },

  {
    label: "Answers from your own content",
    neylon: true,
    intercom: "Fin AI tier",
    chatbase: true,
  },

  {
    label: "Human escalation & inbox",
    neylon: true,
    intercom: true,
    chatbase: false,
  },

  {
    label: "Conversation memory",
    neylon: true,
    intercom: true,
    chatbase: false,
  },

  {
    label: "Visitor retention insights",
    neylon: true,
    intercom: false,
    chatbase: false,
  },

  {
    label: "Slack / CRM notifications",
    neylon: "Pro+",
    intercom: true,
    chatbase: false,
  },

  {
    label: "Full widget customization",
    neylon: "Starter+",
    intercom: true,
    chatbase: true,
  },

  {
    label: "India payments (Razorpay)",
    neylon: true,
    intercom: false,
    chatbase: false,
  },
  { label: "Embeddable SDK", neylon: true, intercom: false, chatbase: false },
];

export function Comparison() {
  return (
    <section
      id="comparison-table"
      className="py-10 sm:py-12 lg:py-20 overflow-hidden"
    >
      {/* Heading — padded both sides */}
      <div className="px-6 sm:px-10 md:px-20 lg:px-28 text-center mb-8 sm:mb-10">
        <p className="text-xs uppercase tracking-widest text-gray-400 mb-2 font-medium">
          Comparison
        </p>
        <h2
          className="landing-strong text-2xl md:text-3xl xl:text-4xl leading-tight"
          style={{ color: GREEN }}
        >
          More for less, compared to the rest.
        </h2>
      </div>

      {/* Mobile: left-padded only, bleeds right with 3px buffer. md+: symmetric padding, no bleed */}
      <div
        className="overflow-x-auto [&::-webkit-scrollbar]:hidden pl-6 pr-[3px] py-[3px] sm:pl-10 md:px-20 md:py-2 lg:px-28"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="min-w-[520px]">
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
                className="py-5 px-4 md:py-6 md:px-6 flex flex-col items-center gap-1 border-l border-black/[0.07]"
                style={{ background: "rgba(14,50,40,0.04)" }}
              >
                <span
                  className="landing-strong text-sm md:text-base"
                  style={{ color: GREEN }}
                >
                  Neylon AI
                </span>
                <span
                  className="text-[10px] md:text-[11px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: LIME, color: GREEN }}
                >
                  Best value
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
                <div className="py-3.5 px-5 md:py-4 md:px-8 flex items-center text-xs md:text-sm text-gray-600">
                  {row.label}
                </div>
                <div
                  className="py-3.5 px-4 md:py-4 md:px-6 flex items-center justify-center border-l border-black/[0.07]"
                  style={{ background: "rgba(14,50,40,0.03)" }}
                >
                  <Cell val={row.neylon} highlight />
                </div>
                <div className="py-3.5 px-4 md:py-4 md:px-6 flex items-center justify-center border-l border-black/[0.07]">
                  <Cell val={row.intercom} />
                </div>
                <div className="py-3.5 px-4 md:py-4 md:px-6 flex items-center justify-center border-l border-black/[0.07]">
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
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-500">
      <X className="w-4 h-4 flex-shrink-0 text-amber-500" strokeWidth={2.5} />
      {val}
    </span>
  );
}
