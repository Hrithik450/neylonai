"use client";

import {
  X,
  Calendar,
  Minimize2,
  Maximize2,
  ArrowRight,
  MessageCircle,
  MessageSquareQuote,
} from "lucide-react";
import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { guminertBold } from "@/assets/fonts";
import NeylonAI from "@/assets/images/neylon.jpg";
import {
  AssistantKey,
  RoleAssistantMap,
  type Screen,
  TabType,
  useErrorStore,
  useSupportWidgetToggleStore,
  useThreadStore,
  useUserStore,
} from "@/store/store";
import { WidgetIntroText } from "@/components/support-widget/widget-intro-texts";
import { WidgetChatThreadUI } from "@/components/support-widget/tabs/widget-messages/widget-chat-messages-ui";
import { WidgetLogin } from "@/components/support-widget/tabs/widget-screens/widget-login";
import { WidgetFeedback } from "@/components/support-widget/tabs/widget-screens/widget-feedback";
import CustomerServiceAssistantImage from "@/assets/images/articles/customer-service-assistant.png";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/session-store";

const blogs = [
  {
    id: 1,
    image: CustomerServiceAssistantImage,
    type: "Customer service",
    date: "October 26, 2025",
    title:
      "Optimizing Customer Support with AI: The Customer Service Assistant",
    action: "/article/customer-service-assistant",
    assistant: "customer_service_assistant",
  },
] as const;

export interface WidgetHomeProps {
  pushScreen?: (tab: TabType, screen: Screen) => void;
  switchTab?: (tab: TabType) => void;
}

export function WidgetHome({ pushScreen, switchTab }: WidgetHomeProps) {
  const router = useRouter();
  const { role, assistant } = useUserStore();
  const { setCurrentThreadId } = useThreadStore();
  const { setMessage, setStatus } = useErrorStore();
  const { isOpen, isCollapse, setIsOpen, setCollapse } =
    useSupportWidgetToggleStore();
  const { isAuthenticated } = useSessionStore();

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

          <div className="flex-1 flex justify-end items-center gap-4">
            <div className="hidden md:flex items-center h-full my-auto ml-auto">
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
        <WidgetIntroText />
      </div>

      <div className="pb-4 px-2 space-y-6 flex-1">
        {/* Top widgets */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => {
              if (isAuthenticated) {
                setCurrentThreadId(null);
                if (pushScreen)
                  pushScreen(TabType.Messages, {
                    component: WidgetChatThreadUI,
                    props: { id: null, title: null },
                  });
              } else {
                if (pushScreen)
                  pushScreen(TabType.Home, { component: WidgetLogin });
              }
            }}
            className="group cursor-pointer bg-white shadow-sm border rounded-xl px-4 pr-6 py-4 flex justify-between items-center"
          >
            <div className="flex items-center gap-4">
              <MessageCircle className="text-gray-500 w-6 h-6 group-hover:-rotate-12 transition-all duration-150 ease-in-out" />
              <div className="flex flex-col items-start">
                <p className="text-start font-semibold text-sm md:text-base">
                  Ask a question
                </p>
                <p className="text-start text-sm text-gray-600">
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
            <div className="flex justify-start items-center gap-4">
              <Calendar className="text-gray-500 w-6 h-6 group-hover:-rotate-12 transition-all duration-150 ease-in-out" />

              <div className="flex flex-col items-start">
                <p className="font-semibold text-sm md:text-base">
                  Book an appointment
                </p>
                <p className="text-start text-sm text-gray-600">
                  Pick a time that works best for you.
                </p>
              </div>
            </div>
            <ArrowRight className="text-gray-500 w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
          </button>

          <button
            onClick={() => {
              if (isAuthenticated) {
                if (pushScreen) {
                  pushScreen(TabType.Home, {
                    component: WidgetFeedback,
                  });
                }
              } else {
                if (pushScreen) {
                  pushScreen(TabType.Home, { component: WidgetLogin });
                }
                return;
              }
            }}
            className="group cursor-pointer bg-white shadow-sm border rounded-xl px-4 pr-6 py-4 flex justify-between items-center"
          >
            <div className="flex items-center gap-4">
              <MessageSquareQuote className="text-blue-500 w-6 h-6 group-hover:scale-110 transition-transform duration-150 ease-in-out" />
              <div className="flex flex-col items-start">
                <p className="text-start font-semibold text-sm md:text-base">
                  Share Your Feedback
                </p>
                <p className="text-start text-sm text-gray-600">
                  Help us improve with your feedback.
                </p>
              </div>
            </div>
            <ArrowRight className="text-gray-500 w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
          </button>
        </div>

        {/* Latest Insights */}
        <div className="flex flex-col">
          <h3
            className={cn(
              guminertBold.className,
              "mb-2 px-1 text-2xl text-[#0E3228]",
            )}
          >
            Latest Insights
          </h3>

          <div className="space-y-4 my-3">
            {blogs.map((blog) => (
              <div
                key={blog.id}
                className="rounded-2xl border border-gray-600/30 shadow-sm hover:shadow-lg transition-all duration-300 ease-in-out overflow-hidden group"
              >
                {/* Image Section */}
                <div className="relative w-full aspect-1900/900 overflow-hidden">
                  <Image
                    fill
                    src={blog.image}
                    alt={blog.title}
                    className="object-cover w-full h-full transition-transform duration-500"
                  />
                </div>

                {/* Content Section */}
                <div className="space-y-3 p-4">
                  {/* Meta info */}
                  <div className="flex items-center justify-between text-black/90 text-sm ">
                    <span className="truncate max-w-[60%]">{blog.type}</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" /> {blog.date}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base md:text-lg font-semibold text-black line-clamp-2">
                    {blog.title}
                  </h3>

                  {/* CTA Button */}
                  <button
                    onClick={() => {
                      if (isAuthenticated) {
                        if (!role) return;
                        const allowedAssistants = RoleAssistantMap[role] ?? [];

                        // If role doesn't permit this assistant
                        if (
                          !allowedAssistants.includes(
                            blog.assistant as AssistantKey,
                          )
                        ) {
                          setStatus("error");
                          setMessage(
                            "Please change your role to Business Owner to access this article.",
                          );
                          if (switchTab) switchTab(TabType.Settings);
                          return;
                        }

                        // If selected assistant doesn't match the page assistant
                        if (assistant !== blog.assistant) {
                          setStatus("error");
                          setMessage(
                            "Please select the Customer Service Assistant to access this article.",
                          );
                          if (switchTab) switchTab(TabType.Settings);
                          return;
                        }

                        setIsOpen(false);
                        return router.push(blog.action);
                      } else {
                        if (pushScreen)
                          pushScreen(TabType.Home, { component: WidgetLogin });
                      }
                    }}
                    className="group/btn flex items-center justify-center gap-1.5 text-md font-medium border border-gray-500 text-black px-4 py-1.5 rounded-full hover:cursor-pointer hover:bg-[#00b894]/20 hover:border-[#00b894] transition-all duration-300 ease-in-out w-full"
                  >
                    Read More
                    <ArrowRight className="w-4 h-4 text-black group-hover/btn:translate-x-1 transition-transform duration-300" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
