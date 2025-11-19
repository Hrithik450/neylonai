"use client";

import {
  X,
  Calendar,
  Minimize2,
  Maximize2,
  ArrowRight,
  MessageSquareQuote,
  MessageCircle,
  Linkedin,
  Youtube,
  Mail,
} from "lucide-react";
import React from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { guminertBold } from "@/assets/fonts";

import { WidgetScreens, WidgetTabs } from "@/lib/constants";
import { useWidgetToggleStore } from "@/store/widget-store";
import { WidgetIntroText } from "@/components/widget/widget-intro-texts";

import NeylonAI from "@/assets/images/neylon.jpg";
import AgentsImage from "@/assets/images/agents.webp";
import { useWidgetNavigation } from "@/hooks/use-widget-navigation";

const blogs = [
  {
    id: 1,
    image: AgentsImage,
    type: "Latest Insights",
    date: "October 26, 2025",
    title: "73% of Customer Questions Never Needed a Human Agent",
    action: "/article/customer-service-assistant",
    assistant: "customer_service_assistant",
  },
] as const;

export function WidgetHome() {
  const { navigate } = useWidgetNavigation();
  const { isOpen, isCollapse, setIsOpen, setCollapse } = useWidgetToggleStore();

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
              navigate(
                WidgetTabs.Messages,
                WidgetScreens.MessagesScreens.Messages,
              );
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
            // onClick={() => {
            //   if (isAuthenticated) {
            //     if (pushScreen) {
            //       pushScreen(WidgetTabs.Home, {
            //         screen: WidgetFeedback,
            //       });
            //     }
            //   } else {
            //     if (pushScreen) {
            //       pushScreen(TabType.Home, { component: WidgetLogin });
            //     }
            //     return;
            //   }
            // }}
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
                  {/* <button
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
                  </button> */}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Contact Section */}
        <div className="flex flex-col items-center gap-3 my-4">
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-800">
              Powered by Neylon AI
            </p>
            <p className="text-xs text-gray-500">
              AI assistants for modern businesses
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="https://www.linkedin.com/in/hruthik-m-3595a0329/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-[#0A66C2]/10 text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white transition-all duration-200"
            >
              <Linkedin className="w-4 h-4" />
            </a>

            <a
              href="https://youtube.com/@mhrithik450"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-[#FF0000]/10 text-[#FF0000] hover:bg-[#FF0000] hover:text-white transition-all duration-200"
            >
              <Youtube className="w-4 h-4" />
            </a>

            <a
              href="mailto:mhrithik450@gmail.com"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-[#EA4335]/10 text-[#EA4335] hover:bg-[#EA4335] hover:text-white transition-all duration-200"
            >
              <Mail className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
