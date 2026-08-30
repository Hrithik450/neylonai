"use client";

import { ArrowDownRight, HelpCircle } from "lucide-react";
import React from "react";

import { cn } from "../../ui";
import { useWidgetHost } from "../context/widget-host";

const FAQ_LIMIT = 4;
const EXPAND_MS = 420;

function FaqAnswer({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  const innerRef = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(0);

  React.useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const measure = () => {
      setHeight(open ? el.scrollHeight : 0);
    };
    measure();

    if (!open) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, children]);

  return (
    <div
      aria-hidden={!open}
      className="overflow-hidden"
      style={{
        height,
        opacity: open ? 1 : 0,
        transition: `height ${EXPAND_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${Math.round(EXPAND_MS * 0.75)}ms ease`,
      }}
    >
      <div ref={innerRef} className="pt-1">
        {children}
      </div>
    </div>
  );
}

/**
 * Home FAQ accordion — from widget config (seeded once from knowledge, then dashboard-owned).
 */
export function WidgetFaqs() {
  const { config } = useWidgetHost();
  const accent = config.branding.primaryTextColor;
  const secondary = config.branding.secondaryTextColor;
  const surface = config.branding.secondaryTextBackground;
  const brandName = config.branding.name?.trim() || null;
  const faqs = config.messages.faqs
    .filter((f) => f.question.trim() && f.answer.trim())
    .slice(0, FAQ_LIMIT);
  const [openFaqId, setOpenFaqId] = React.useState<string | null>(null);

  if (faqs.length === 0) return null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 px-0.5">
        <HelpCircle className="w-3.5 h-3.5" style={{ color: accent }} aria-hidden />
        <h4
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: secondary }}
        >
          {brandName ? `FAQs from ${brandName}` : "FAQs"}
        </h4>
      </div>

      <div className="flex flex-col gap-2.5">
        {faqs.map((faq, idx) => {
          const id = `faq-${idx}`;
          const open = openFaqId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setOpenFaqId(open ? null : id)}
              aria-expanded={open}
              className="w-full text-left rounded-2xl border px-3.5 py-3 transition-opacity duration-300 ease-in-out hover:opacity-95"
              style={{
                backgroundColor: surface,
                borderColor: config.branding.borderColor,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="shrink-0 text-sm font-bold tabular-nums leading-none"
                  style={{ color: secondary }}
                >
                  0{idx + 1}
                </span>
                <span
                  className="flex-1 min-w-0 text-sm font-semibold leading-snug"
                  style={{ color: accent }}
                >
                  {faq.question}
                </span>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-transform duration-300 ease-in-out",
                    open && "-rotate-90",
                  )}
                  style={{
                    backgroundColor: surface,
                    borderColor: config.branding.borderColor,
                    borderRadius: "9999px",
                  }}
                >
                  <ArrowDownRight
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ color: secondary }}
                  />
                </span>
              </div>

              <FaqAnswer open={open}>
                <p
                  className="m-0 pl-7 pr-1 text-sm leading-relaxed"
                  style={{ color: secondary }}
                >
                  {faq.answer}
                </p>
              </FaqAnswer>
            </button>
          );
        })}
      </div>
    </div>
  );
}
