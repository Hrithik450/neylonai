"use client";

import {
  X,
  Calendar,
  Minimize2,
  Maximize2,
  ArrowRight,
  MessageCircle,
  ArrowDownRight,
} from "lucide-react";
import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { faqs } from "@/lib/constants";
import { guminertBold } from "@/assets/fonts";
import NeylonAI from "@/assets/images/neylon.jpg";
import {
  type Screen,
  TabType,
  useSupportWidgetToggleStore,
  useThreadStore,
} from "@/store/store";
import { WidgetIntroText } from "@/components/support-widget/widget-intro-texts";
import { Session } from "next-auth";
import { WidgetChatThreadUI } from "@/components/support-widget/tabs/widget-messages/widget-chat-messages-ui";

export interface WidgetHomeProps {
  pushScreen?: (tab: TabType, screen: Screen) => void;
  switchTab?: (tab: TabType) => void;
  session?: Session | null;
}

export function WidgetHome({
  session,
  pushScreen,
  switchTab,
}: WidgetHomeProps) {
  const { setCurrentThreadId } = useThreadStore();
  const { isOpen, isCollapse, setIsOpen, setCollapse } =
    useSupportWidgetToggleStore();
  const [faqOpen, setFaqOpen] = React.useState<number | null>(0);

  return (
    <section className="px-2 lg:px-3">
      <div className="py-2 pb-4 px-2 text-white rounded-b-2xl">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Image
              src={NeylonAI}
              alt="neylon-image"
              className="w-10 h-10 rounded-full"
            />
            <h3 className={cn(guminertBold.className, "text-xl text-black")}>
              Nelyon AI
            </h3>
          </div>

          <div className="flex-1 flex justify-center items-center gap-4">
            <div className="flex items-center h-full my-auto ml-auto">
              <button
                className="text-xl font-bold cursor-pointer h-full"
                onClick={() => setCollapse(!isCollapse)}
              >
                {isCollapse ? (
                  <Maximize2 className="w-5 h-5 text-black" />
                ) : (
                  <Minimize2 className="w-5 h-5 text-black" />
                )}
              </button>
            </div>

            <div className="flex items-center h-full my-auto">
              <button
                className="text-xl font-bold cursor-pointer h-full"
                onClick={() => setIsOpen(!isOpen)}
              >
                <X className="w-5 h-5 text-black" />
              </button>
            </div>
          </div>
        </div>

        {/* Introduction texts */}
        <WidgetIntroText session={session} />
      </div>

      <div className="pb-4 px-2 space-y-4 flex-1">
        {/* Top widgets */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => {
              setCurrentThreadId(null);
              if (pushScreen) {
                pushScreen(TabType.Messages, {
                  component: WidgetChatThreadUI,
                  props: { id: null, title: null },
                });
              }
            }}
            className="group cursor-pointer bg-white shadow-sm border rounded-xl px-4 pr-6 py-4 flex justify-between items-center"
          >
            <div className="flex items-center gap-4">
              <MessageCircle className="text-gray-500 w-6 h-6 group-hover:-rotate-12 transition-all duration-150 ease-in-out" />
              <div>
                <p className="text-start font-semibold text-sm md:text-base">
                  Ask a question
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  Our AI Assistant Can Help.
                </p>
              </div>
            </div>
            <ArrowRight className="text-gray-500 w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
          </button>

          <button
            onClick={() => {
              if (switchTab) switchTab(TabType.Contact);
            }}
            className="group cursor-pointer bg-white shadow-sm border rounded-xl px-4 pr-6 py-4 flex justify-between items-center"
          >
            <div className="flex items-center gap-4">
              <Calendar className="text-gray-500 w-6 h-6 group-hover:-rotate-12 transition-all duration-150 ease-in-out" />

              <div>
                <p className="text-start font-semibold text-sm md:text-base">
                  Book an appointment
                </p>
                <p className="text-xs md:text-sm text-gray-600">
                  Pick a time that works best for you.
                </p>
              </div>
            </div>
            <ArrowRight className="text-gray-500 w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
          </button>
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
    </section>
  );
}
