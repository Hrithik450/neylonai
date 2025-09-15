"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { guminertMedium, guminertRegular, sfProRegular } from "@/assets/fonts";
import { ArrowDownRight, ArrowRightIcon } from "lucide-react";
import { faqs } from "@/lib/constants";

export function Faq() {
  const [openInd, setOpenInd] = React.useState<number | null>(0);

  return (
    <section
      className={cn(
        sfProRegular.className,
        "pt-4 md:pt-8 mt-4 md:mt-8 px-3 md:px-5 xl:px-10 2xl:px-15 relative"
      )}
    >
      <header className="relative flex flex-col gap-4 md:gap-0 md:flex-row justify-between items-start md:items-end">
        <h2
          className={cn(
            guminertMedium.className,
            "max-w-2xl text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl leading-tight md:leading-15 xl:leading-17 2xl:leading-19"
          )}
        >
          Frequently Asked Questions
        </h2>

        <button
          className={cn(
            "group flex items-center gap-3 2xl:mr-10 bg-[#0d3129] p-3 px-6 rounded-full text-white cursor-pointer text-sm md:text-lg",
            guminertRegular.className
          )}
        >
          Explore Services
          <ArrowRightIcon className="w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
        </button>
      </header>

      <main className="relative flex flex-col lg:flex-row items-stretch justify-center my-6 lg:my-10 gap-6">
        <div className="flex-1 flex flex-col space-y-4">
          {faqs.length > 0 &&
            faqs.map((faq, idx) => (
              <div
                key={idx}
                onClick={() => setOpenInd(openInd === idx ? null : idx)}
                className={cn(
                  "flex-1 flex flex-col justify-center items-start py-4 px-4 border border-gray-500/40 rounded-3xl transition-all duration-300",
                  openInd === idx
                    ? "bg-[linear-gradient(rgb(245,255,249)_0%,rgb(251,255,242)_100%)]"
                    : ""
                )}
              >
                <div className="w-full flex items-center justify-start gap-6 md:gap-8">
                  <div className="text-3xl md:text-4xl font-bold text-gray-500/60">
                    0{idx + 1}
                  </div>

                  <div>
                    <h3 className="text-xl md:text-2xl font-semibold">
                      {faq.question}
                    </h3>
                  </div>

                  <div
                    className={cn(
                      "ml-auto bg-white p-3 rounded-full cursor-pointer transition-all duration-300 ease-in-out",
                      openInd === idx ? "-rotate-90 self-start" : ""
                    )}
                  >
                    <ArrowDownRight />
                  </div>
                </div>

                <div
                  className={cn(
                    "grid transition-all duration-500 ease-in-out",
                    openInd === idx
                      ? "grid-rows-[1fr] opacity-100 mt-2"
                      : "grid-rows-[0fr] opacity-0"
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-md text-gray-500">{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
        </div>

        <div className="flex-1 flex flex-col bg-[#f2f2f2] p-4 md:p-8 rounded-2xl space-y-6">
          <div className="flex-1 flex flex-col bg-white rounded-2xl p-5 md:p-10 px-4 md:px-8 relative overflow-hidden shadow-md hover:rotate-2 transition-all duration-150 ease-in-out">
            <h2 className="relative z-10 text-2xl font-semibold">
              Revenue Overview
            </h2>

            <h1 className="relative z-10 mt-8 text-4xl xl:text-5xl font-semibold">
              <sup className="text-gray-500">$</sup> 9,679.00
            </h1>
            <p className="relative z-10 text-sm lg:text-md 2xl:text-lg text-gray-500 mt-2 mb-4">
              Our most recent marketing profit
            </p>

            <div className="absolute bottom-0 left-10 md:left-15 2xl:left-20 w-full flex items-end justify-between px-8 gap-6 z-0">
              <div className="h-10 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(179,224,74)_0%,white_100%)]" />
              <div className="h-15 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(179,224,74)_0%,white_100%)]" />
              <div className="h-40 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(179,224,74)_0%,white_100%)]" />
              <div className="h-30 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(179,224,74)_0%,white_100%)]" />
              <div className="h-50 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(179,224,74)_0%,white_100%)]" />
            </div>
          </div>

          <div className="relative flex-1 flex flex-col bg-white pt-6 rounded-2xl overflow-hidden shadow-md hover:rotate-2 transition-all duration-150 ease-in-out">
            <div className="flex-1 px-4 md:px-8 max-lg:mb-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-semibold">Total Expenses</h2>
                <span className="p-0.5 px-4 rounded-2xl shadow-sm bg-green-200 text-green-700">
                  40%
                </span>
              </div>

              <div className="mt-8 flex items-center justify-between gap-2 w-full">
                <div className="flex flex-col gap-2 flex-[35]">
                  <div className="h-2 rounded-full bg-[#57a2ed] w-full" />
                  Living
                </div>

                <div className="flex flex-col gap-2 flex-[30]">
                  <div className="h-2 rounded-full bg-[#9e59ea] w-full" />
                  Shopping
                </div>

                <div className="flex flex-col gap-2 flex-[25]">
                  <div className="h-2 rounded-full bg-[#facb4a] w-full" />
                  Travel
                </div>

                <div className="flex flex-col gap-2 flex-[40]">
                  <div className="h-2 rounded-full bg-[#68994a] w-full" />
                  Saving
                </div>
              </div>
            </div>

            <div className="mt-auto w-full cursor-pointer px-5 md:px-10 py-2 flex justify-between items-center bg-[#0d3129] group">
              <span className="text-md text-white">See Details</span>
              <ArrowRightIcon className="text-white w-5 h-5 group-hover:-rotate-45 transition-all duration-300 ease-in-out" />
            </div>
          </div>
        </div>
      </main>
    </section>
  );
}
