"use client";

import NeylonAI from "@/assets/images/neylon.jpg";
import { guminertMedium, guminertRegular, sfProRegular } from "@/assets/fonts";
import { ArrowRightIcon, Clock, Server, ShieldCheck, Zap } from "lucide-react";

import { useWidgetToggleStore } from "@/store/widget-store";
import FeatureGrid from "@/assets/images/feature_grid.jpg";
import gemini from "@/assets/images/google-gemini.webp";
import perplexity from "@/assets/images/perplexity.png";
import anthropic from "@/assets/images/anthropic-3.png";
import deepseek from "@/assets/images/deep-seek.png";
import gpt from "@/assets/images/gpt.png";
import { AvatarGroup } from "../avatar-group";
import { cn } from "@/lib/utils";
import Image from "next/image";

export function FeatureSection() {
  const { setIsOpen } = useWidgetToggleStore();

  return (
    <section
      id="features"
      className={cn(
        sfProRegular.className,
        "my-4 md:my-16 px-3 md:px-5 xl:px-10 2xl:px-15 relative",
      )}
    >
      <header className="relative flex flex-col gap-4 md:gap-0 md:flex-row justify-between items-start md:items-end">
        <h2
          className={cn(
            guminertMedium.className,
            "max-w-xl text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl leading-tight md:leading-15 xl:leading-17 2xl:leading-19",
          )}
        >
          Our Features
        </h2>

        <button
          onClick={() => {
            setIsOpen(true);
          }}
          className={cn(
            "group flex items-center gap-3 bg-[#0d3129] p-3 px-6 rounded-full text-white cursor-pointer text-sm md:text-lg",
            guminertRegular.className,
          )}
        >
          Try Live Demo
          <ArrowRightIcon className="w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
        </button>
      </header>

      <main className="relative grid grid-cols-1 md:grid-cols-4 items-stretch justify-center my-6 lg:my-10 gap-4 sm:gap-6">
        <div className="max-sm:flex sm:hidden lg:flex flex-col row-span-2 col-span-1 bg-[#f2f2f2] rounded-xl px-4 py-6 shadow-md hover:rotate-2 transition-all duration-150 ease-in-out">
          <h3 className="text-2xl xl:text-3xl 2xl:text-4xl max-w-xs leading-tight font-semibold">
            FAQ Automation
          </h3>

          <div className="py-10 sm:py-12">
            <AvatarGroup
              avatars={[gpt, gemini, perplexity, anthropic, deepseek]}
            />
            <p className="text-black text-2xl pt-2 font-semibold">
              Automate decisions with industry-standard models.
            </p>
          </div>

          <h1 className="text-5xl font-semibold">FAQs</h1>
          <span className="text-lg xl:text-xl py-2 text-gray-600">
            answered automatically without manual support.
          </span>
        </div>
        <div className="row-span-1 col-span-1 sm:col-span-3 lg:col-span-2 relative flex flex-col h-full rounded-xl overflow-hidden shadow-md px-4 py-6 hover:rotate-2 transition-all duration-150 ease-in-out">
          <div className="absolute inset-0">
            <Image
              src={FeatureGrid}
              alt="feature-grid"
              className="w-full h-full"
            />
          </div>

          <h3 className="relative text-xl xl:text-3xl 2xl:text-4xl max-w-xs leading-tight">
            Automatic Lead Capture
          </h3>

          <div className="relative z-10 mt-6 max-w-md">
            <span className="text-md lg:text-xl max-w-3xl text-gray-600">
              Capture leads and answer customer questions even when your team is
              offline.
            </span>
          </div>

          <div className="absolute bottom-0 left-10 z-0 w-full flex items-end justify-between px-8 gap-6">
            <div className="h-10 flex-1 rounded-t-md lg:rounded-t-2xl bg-[linear-gradient(to_bottom,rgba(41,82,52,0.9)_0%,white_100%)]" />
            <div className="h-15 flex-1 rounded-t-md lg:rounded-t-2xl bg-[linear-gradient(to_bottom,rgba(41,82,52,0.9)_0%,white_100%)]" />
            <div className="h-40 flex-1 rounded-t-md lg:rounded-t-2xl bg-[linear-gradient(to_bottom,rgba(41,82,52,0.9)_0%,white_100%)]" />
            <div className="h-30 flex-1 rounded-t-md lg:rounded-t-2xl bg-[linear-gradient(to_bottom,rgba(41,82,52,0.9)_0%,white_100%)]" />
            <div className="h-50 flex-1 rounded-t-md lg:rounded-t-2xl bg-[linear-gradient(to_bottom,rgba(41,82,52,0.9)_0%,white_100%)]" />
          </div>
        </div>

        <div className="col-span-1 relative bg-linear-to-b from-[#0d3129] to-[#134239] flex flex-col h-full gap-4 sm:gap-6 p-2 rounded-xl overflow-hidden shadow-lg px-4 2xl:px-6 py-6 hover:rotate-2 transition-all duration-300 ease-in-out">
          {/* Main Stats */}
          <h1 className="text-4xl xl:text-5xl font-semibold text-white">
            24x7
          </h1>
          <span className="text-md lg:text-lg max-w-50 text-gray-300">
            Appointment Booking Automation
          </span>

          {/* Bottom Badge Indicators */}
          <div className="flex gap-2 mt-auto">
            <span className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-sm text-green-300 hover:bg-white/20 transition-colors duration-200">
              <Clock className="w-3 h-3 pr-1 animate-ping text-green-400" />
              Instant
            </span>
            <span className="flex items-center gap-1 bg-white/10 px-3 py-1 rounded-full text-sm text-yellow-300 hover:bg-white/20 transition-colors duration-200">
              <Zap className="w-3 h-3 pr-1 animate-bounce text-yellow-400" />
              Automated
            </span>
          </div>
        </div>

        <div className="col-span-1 sm:col-start-1 lg:col-start-2 flex flex-col h-full bg-linear-to-b from-[#0d3129] to-[#134239] text-white rounded-xl overflow-hidden shadow-lg px-4 py-6 hover:rotate-2 transition-all duration-300 ease-in-out">
          {/* Logo */}
          <div className="flex flex-col justify-center items-start gap-1 bg-white h-16 w-16 rounded-xl text-black overflow-hidden p-0.5 shadow-inner">
            <Image
              src={NeylonAI}
              alt="neylon-ai"
              className="w-full h-full object-cover rounded-full"
              width={48}
              height={48}
            />
          </div>

          {/* Content */}
          <p className="mt-2 text-xl lg:text-2xl max-w-62.5 font-semibold">
            Unified Customer Dashboard
          </p>

          {/* Description */}
          <span className="text-sm 2xl:text-md text-gray-300 max-w-67.5 mt-2 lg:mt-1">
            Manage leads, customer conversations, and support requests from one
            simple dashboard.
          </span>

          {/* Bottom animated info or badges */}
          <div className="flex gap-3 mt-4">
            <span className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full text-xs text-green-300 hover:bg-white/20 transition-colors duration-200">
              <svg
                className="w-3 h-3 animate-ping text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <circle cx="10" cy="10" r="5" />
              </svg>
              Leads
            </span>

            <span className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full text-xs text-yellow-300 hover:bg-white/20 transition-colors duration-200">
              <svg
                className="w-3 h-3 animate-bounce text-yellow-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <circle cx="10" cy="10" r="5" />
              </svg>
              Support
            </span>

            <span className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full text-xs text-blue-300 hover:bg-white/20 transition-colors duration-200">
              <svg
                className="w-3 h-3 animate-pulse text-blue-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <circle cx="10" cy="10" r="5" />
              </svg>
              Organized
            </span>
          </div>
        </div>

        <div className="relative bg-[#f2f2f2] col-span-1 sm:col-span-3 lg:col-span-2 sm:col-start-2 lg:col-start-3 flex flex-col md:flex-row items-start md:items-center gap-6 p-3 rounded-xl overflow-hidden shadow-md px-4 py-6 hover:rotate-2 transition-all duration-150 ease-in-out">
          <div className="px-4 md:px-6 py-4 sm:py-0 2xl:px-10 bg-white rounded-xl flex flex-col h-full gap-2 justify-center items-start md:items-center group">
            <ShieldCheck className="pr-2 w-18 h-18 group-hover:scale-110 group-hover:rotate-5 transition-all duration-150 ease-in-out" />
            <h1 className="text-5xl font-semibold">100%</h1>
            <p className="text-lg max-w-sm">Customer Coverage.</p>
          </div>

          <div className="flex-1 flex flex-col h-full justify-around items-start space-y-2">
            <h3 className="text-3xl max-w-67.5 font-semibold">
              Support Tickets Management.
            </h3>

            <p className="text-sm md:text-base 2xl:text-lg text-gray-500">
              Automatically capture, organize, and track every customer inquiry
              from a single dashboard.
            </p>

            {/* 
            <button className="text-md 2xl:text-lg cursor-pointer flex items-center gap-1 group">
              Read More
              <ArrowRightIcon className="w-4 h-4 2xl:w-5 2xl:h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
            </button> */}
          </div>
        </div>

        {/* <div className="relative bg-[#f2f2f2] col-span-1 md:col-span-4 grid grid-cols-2 sm:grid-cols-4 items-center gap-6 rounded-xl overflow-hidden pr-2 md:px-4 py-6">
          <div className="col-span-1 space-y-2 mx-auto">
            <div className="flex items-center group gap-1">
              <ArrowUpFromDot className="h-10 w-10 2xl:w-15 2xl:h-15 group-hover:rotate-45 transition-all duration-150 ease-in-out" />
              <h1 className="text-5xl xl:text-6xl 2xl:text-7xl">99%</h1>
            </div>

            <p className="text-gray-500 text-sm lg:text-lg 2xl:text-xl text-center">
              Data Security
            </p>
          </div>

          <div className="col-span-1 space-y-2 mx-auto">
            <div className="flex items-center group gap-1">
              <ArrowUpFromDot className="h-10 w-10 2xl:w-15 2xl:h-15 group-hover:rotate-45 transition-all duration-150 ease-in-out" />
              <h1 className="text-5xl xl:text-6xl 2xl:text-7xl">24/7</h1>
            </div>

            <p className="text-gray-500 text-sm lg:text-lg 2xl:text-xl text-center">
              Assistant Uptime
            </p>
          </div>

          <div className="col-span-1 space-y-2 mx-auto">
            <div className="flex items-center group gap-1">
              <ArrowUpFromDot className="h-10 w-10 2xl:w-15 2xl:h-15 group-hover:rotate-45 transition-all duration-150 ease-in-out" />
              <h1 className="text-5xl xl:text-6xl 2xl:text-7xl">98%</h1>
            </div>

            <p className="text-gray-500 text-sm lg:text-lg 2xl:text-xl text-center">
              Precision Insights
            </p>
          </div>

          <div className="col-span-1 space-y-2 mx-auto">
            <div className="flex items-center group gap-1">
              <ArrowUpFromDot className="h-10 w-10 2xl:w-15 2xl:h-15 group-hover:rotate-45 transition-all duration-150 ease-in-out" />
              <h1 className="text-5xl xl:text-6xl 2xl:text-7xl">85%</h1>
            </div>

            <p className="text-gray-500 text-sm lg:text-lg 2xl:text-xl text-center">
              Lead Conversion
            </p>
          </div>
        </div> */}
      </main>
    </section>
  );
}
