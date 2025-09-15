"use client";

import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { faqs } from "@/lib/constants";
import CTAImage from "/public/images/ai-solutionz-logo.jpg";
import { guminertBold, guminertRegular } from "@/assets/fonts";
import {
  MessageCircleQuestionMark,
  MessageSquareText,
  ArrowDownRight,
  MessageCircle,
  ArrowRight,
  Calendar,
  House,
  X,
} from "lucide-react";

const navigations = [
  { icon: <House className="w-6 h-6" />, label: "Home" },
  {
    icon: <MessageSquareText className="w-6 h-6" />,
    label: "Messages",
  },
  { icon: <MessageCircleQuestionMark className="w-6 h-6" />, label: "Help" },
];

export function SupportWidget({
  isOpen,
  setIsOpen,
}: {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const [faqOpen, setFaqOpen] = React.useState<number | null>(0);

  // Intro text animation
  const [introText, setIntroText] = React.useState("");
  const fullIntroText = "Hi there!";

  // Desc text animation
  const [displayText, setDisplayText] = React.useState("");
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

  // Refs to store intervals so we can clear them
  const typingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const introIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const nextTextTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const clearAllTimers = () => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);
    if (nextTextTimeoutRef.current) clearTimeout(nextTextTimeoutRef.current);
  };

  const typingEffect = React.useCallback(
    (text: string, index: number) => {
      let i = -1;
      typingIntervalRef.current = setInterval(() => {
        setDisplayText((prev) => prev + text.charAt(i));
        i++;
        if (i === text.length) {
          clearInterval(typingIntervalRef.current!);

          nextTextTimeoutRef.current = setTimeout(() => {
            setDisplayText("");
            if (index + 1 < texts.length) {
              typingEffect(texts[index + 1], index + 1);
            } else {
              typingEffect(texts[0], 0);
            }
          }, 1000);
        }
      }, 70);
    },
    [texts]
  );

  React.useEffect(() => {
    if (isOpen) {
      clearAllTimers();
      setDisplayText("");
      setIntroText("");

      let index = 0;
      introIntervalRef.current = setInterval(() => {
        setIntroText(fullIntroText.slice(0, index + 1));
        index++;

        if (index === fullIntroText.length) {
          clearInterval(introIntervalRef.current!);
          typingEffect(texts[0], 0);
        }
      }, 70);
    } else {
      clearAllTimers();
    }

    return () => clearAllTimers();
  }, [isOpen, texts, typingEffect]);

  return (
    <div
      className={cn(
        guminertRegular.className,
        "fixed z-99 bottom-23 right-5 sm:right-8 bg-[linear-gradient(to_bottom,rgb(144,238,144)_0%,white_100%)] border border-gray-400/40 shadow-2xl rounded-2xl p-2 sm:p-4 max-w-sm max-h-[85vh] flex flex-col origin-bottom-right transition-all duration-300 transform",
        isOpen
          ? "opacity-100 scale-100"
          : "opacity-0 scale-0 pointer-events-none"
      )}
    >
      {/* Home Start*/}
      <div className="py-4 px-2 text-white rounded-b-2xl">
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
            className="text-xl font-bold cursor-pointer"
            onClick={() => setIsOpen(!isOpen)}
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>

        {/* Introduction texts */}
        <div className={cn("mt-8 px-1 text-[#0E3228]", guminertBold.className)}>
          <h2 className="text-lg md:text-2xl font-bold">
            <span className="fade-in">{introText}</span>
          </h2>
          <p className="text-sm md:text-lg font-normal fade-in h-6 text-black/70">
            <span className="fade-in">{displayText}</span>
          </p>
        </div>
      </div>

      <div className="pb-4 px-2 space-y-4 flex-1 overflow-y-auto scrollbar-hide">
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
      {/* Home End */}

      {/* Navigation's */}
      <div className="border-t flex justify-around pt-3">
        {navigations.map((btn, idx) => (
          <button
            key={idx}
            className={`flex flex-col items-center cursor-pointer ${
              idx === 0 ? "text-purple-600" : "text-gray-500"
            }`}
          >
            <span>{btn.icon}</span>
            <span className="text-xs sm:text-sm">{btn.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
