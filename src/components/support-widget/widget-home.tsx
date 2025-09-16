"use client";

import {
  X,
  Calendar,
  ArrowRight,
  MessageCircle,
  ArrowDownRight,
} from "lucide-react";
import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { faqs } from "@/lib/constants";
import { guminertBold } from "@/assets/fonts";
import CTAImage from "/public/images/ai-solutionz-logo.jpg";
import { useSupportWidgetToggleStore } from "@/store/store";
import { useTypingAnimation } from "@/components/support-widget";

export function Home({}) {
  const texts = React.useMemo(
    () => [
      "How can I assist you today?",
      "I am your AI assistant from AI Solutionz.",
      "We build smart and scalable AI solutions for your business.",
      "From chatbots to automation, we make AI simple.",
      "Your growth partner in intelligent automation.",
    ],
    []
  );

  const { isOpen, setIsOpen } = useSupportWidgetToggleStore();
  const [faqOpen, setFaqOpen] = React.useState<number | null>(0);
  const { introText, displayText, startAnimation } = useTypingAnimation(
    texts,
    "Hi there!"
  );

  React.useEffect(() => {
    if (isOpen) startAnimation();
  }, [isOpen, startAnimation]);

  return (
    <>
      <div className="py-2 pb-4 px-2 text-white rounded-b-2xl">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image
              src={CTAImage}
              alt="cta-image"
              className="w-12 h-12 rounded-full"
            />
            <h3 className={cn(guminertBold.className, "text-xl text-black")}>
              AI Solutionz
            </h3>
          </div>

          <button
            className="text-xl font-bold cursor-pointer pr-2"
            onClick={() => setIsOpen(!isOpen)}
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Introduction texts */}
        <div className={cn("mt-8 px-1 text-[#0E3228]", guminertBold.className)}>
          <h2 className="text-2xl font-bold mb-0.5">
            <span className="fade-in">{introText}</span>
          </h2>
          <p className="text-lg font-normal fade-in h-6 text-black/70">
            <span className="fade-in">{displayText}</span>
          </p>
        </div>
      </div>

      <div className="pb-4 px-2 space-y-4 flex-1">
        {/* Top widgets */}
        <div className="flex flex-col gap-2.5">
          <div className="group cursor-pointer bg-white shadow-sm border rounded-xl px-4 pr-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <MessageCircle className="text-gray-500 w-6 h-6 group-hover:-rotate-12 transition-all duration-150 ease-in-out" />
              <div>
                <p className="font-semibold text-sm md:text-base">
                  Ask a question
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  Our AI Assistant Can Help.
                </p>
              </div>
            </div>
            <ArrowRight className="text-gray-500 w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
          </div>

          <div className="group cursor-pointer bg-white shadow-sm border rounded-xl px-4 pr-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Calendar className="text-gray-500 w-6 h-6 group-hover:-rotate-12 transition-all duration-150 ease-in-out" />

              <div>
                <p className="font-semibold text-sm md:text-base">
                  Book an appointment
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  Pick a time that works best for you.
                </p>
              </div>
            </div>
            <ArrowRight className="text-gray-500 w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
          </div>
        </div>

        {/* FAQ's */}
        <h3
          className={cn(guminertBold.className, "px-1 text-xl text-[#0E3228]")}
        >
          Frequently Asked Questions
        </h3>

        {/* Q&A's */}
        <div className="space-y-3">
          {faqs.length > 0 &&
            faqs.map((faq, idx) => (
              <div
                key={idx}
                onClick={() => setFaqOpen(faqOpen === idx ? null : idx)}
                className={cn(
                  "flex-1 flex flex-col justify-center items-start py-4 px-4 border border-gray-500/40 rounded-xl transition-all duration-300",
                  faqOpen === idx
                    ? "bg-[linear-gradient(rgb(245,255,249)_0%,rgb(251,255,242)_100%)]"
                    : ""
                )}
              >
                <div className="w-full flex items-center justify-start gap-4 md:gap-6 space-y-1">
                  <div className="text-xl md:text-2xl font-bold text-gray-500">
                    0{idx + 1}
                  </div>

                  <div>
                    <h3 className="text-md md:text-md font-semibold">
                      {faq.question}
                    </h3>
                  </div>

                  <div
                    className={cn(
                      "ml-auto bg-white p-3 rounded-full cursor-pointer transition-all duration-300 ease-in-out",
                      faqOpen === idx ? "-rotate-90 self-start" : ""
                    )}
                  >
                    <ArrowDownRight />
                  </div>
                </div>

                <div
                  className={cn(
                    "grid transition-all duration-500 ease-in-out",
                    faqOpen === idx
                      ? "grid-rows-[1fr] opacity-100 mt-1"
                      : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-sm text-gray-500">{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
}
