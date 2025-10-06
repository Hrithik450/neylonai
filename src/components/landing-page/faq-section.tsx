"use client";

import { guminertMedium, guminertRegular, sfProRegular } from "@/assets/fonts";
import { ArrowDownRight, ArrowRightIcon } from "lucide-react";
import { Link as ScrollLink } from "react-scroll";
import { faqs } from "@/lib/constants";
import { cn } from "@/lib/utils";
import React from "react";

export function Faq() {
  const [openInd, setOpenInd] = React.useState<number | null>(0);

  return (
    <section
      className={cn(
        sfProRegular.className,
        "my-4 md:my-16 px-3 md:px-5 xl:px-10 2xl:px-15 relative",
      )}
    >
      <header className="relative flex flex-col gap-4 md:gap-0 md:flex-row justify-between items-start md:items-end">
        <h2
          className={cn(
            guminertMedium.className,
            "max-w-2xl text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl leading-tight md:leading-15 xl:leading-17 2xl:leading-19",
          )}
        >
          Frequently Asked Questions
        </h2>

        <button
          className={cn(
            "group 2xl:mr-10 bg-[#0d3129] p-3 px-6 rounded-full text-white cursor-pointer text-sm md:text-lg",
            guminertRegular.className,
          )}
        >
          <ScrollLink
            to="products"
            smooth={true}
            duration={300}
            offset={0}
            className="flex items-center gap-3"
          >
            Start For Free
            <ArrowRightIcon className="w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
          </ScrollLink>
        </button>
      </header>

      <main className="relative flex flex-col lg:flex-row items-stretch justify-center my-6 lg:my-10 gap-6">
        <div className="flex-1 flex flex-col space-y-4 max-w-4xl">
          {faqs.length > 0 &&
            faqs.map((faq, idx) => (
              <div
                key={idx}
                onClick={() => setOpenInd(openInd === idx ? null : idx)}
                className={cn(
                  "flex-1 flex flex-col justify-center items-start py-4 px-4 border border-gray-500/40 rounded-3xl transition-all duration-300",
                  openInd === idx
                    ? "bg-[linear-gradient(rgb(245,255,249)_0%,rgb(251,255,242)_100%)]"
                    : "",
                )}
              >
                <div className="w-full flex items-center justify-start gap-3 md:gap-6">
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
                      openInd === idx ? "-rotate-90 self-start" : "",
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
                      : "grid-rows-[0fr] opacity-0",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="text-sm md:text-lg text-gray-500">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </main>
    </section>
  );
}

//  <div className="flex-1 flex flex-col bg-[#f2f2f2] p-2 md:p-4 rounded-2xl space-y-3">
//   <div className="flex-2 flex flex-col bg-white rounded-2xl p-3 md:p-5 px-4 md:px-8 relative overflow-hidden shadow-md hover:rotate-2 transition-all duration-150 ease-in-out">
//     <h2 className="relative z-10 text-2xl font-semibold">
//       Career Growth Overview
//     </h2>

//     <h1 className="relative z-10 mt-8 text-4xl xl:text-5xl font-semibold">
//       +23%
//     </h1>
//     <p className="relative z-10 text-sm lg:text-md 2xl:text-lg text-gray-500 mt-2 mb-4">
//       Your skill-match improvement this month (based on live job data)
//     </p>

//     <div className="absolute bottom-0 left-10 md:left-15 2xl:left-20 w-full flex items-end justify-between px-8 gap-6 z-0">
//       <div className="h-10 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(179,224,74)_0%,white_100%)]" />
//       <div className="h-15 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(179,224,74)_0%,white_100%)]" />
//       <div className="h-40 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(179,224,74)_0%,white_100%)]" />
//       <div className="h-30 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(179,224,74)_0%,white_100%)]" />
//       <div className="h-50 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(179,224,74)_0%,white_100%)]" />
//     </div>
//   </div>

//   <div className="relative flex-3 flex flex-col bg-white pt-6 rounded-2xl overflow-hidden shadow-md hover:rotate-2 transition-all duration-150 ease-in-out">
//     <div className="flex-1 px-4 md:px-8">
//       <div className="flex flex-wrap justify-between items-center gap-3">
//         <h2 className="text-2xl font-semibold text-gray-800">
//           Live Job-Market Insights
//         </h2>
//         <span className="p-0.5 px-4 rounded-2xl shadow-sm bg-green-200 text-green-700 text-sm font-medium">
//           Updated Daily
//         </span>
//       </div>

//       <div className="pb-4 mt-3 lg:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-6 w-full">
//         <div className="flex flex-col justify-between border border-gray-300/80 bg-[#f9fafb] rounded-xl p-4 shadow-xs hover:shadow-sm transition-all duration-200">
//           <span className="text-gray-600 text-sm mb-1">
//             Most demanded skills this week
//           </span>
//           <span className="font-semibold text-gray-900 text-lg">
//             SQL, Power BI, Python
//           </span>
//         </div>

//         <div className="flex flex-col justify-between border border-gray-300/80 bg-[#f9fafb] rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
//           <span className="text-gray-600 text-sm mb-1">
//             Your profile coverage
//           </span>
//           <span className="font-semibold text-green-600 text-lg">68%</span>
//         </div>

//         <div className="flex flex-col justify-between border border-gray-300/80 bg-[#f9fafb] rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
//           <span className="text-gray-600 text-sm mb-1">Top roles matched</span>
//           <span className="font-semibold text-gray-900 text-lg">
//             Data Analyst, BI Engineer
//           </span>
//         </div>

//         <div className="flex flex-col justify-between border border-gray-300/80 bg-[#f9fafb] rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200">
//           <span className="text-gray-600 text-sm mb-1">
//             Peers above your score
//           </span>
//           <span className="font-semibold text-red-600 text-lg">+14%</span>
//         </div>
//       </div>
//     </div>

//     <div className="mt-auto w-full cursor-pointer px-5 md:px-10 py-2 flex justify-between items-center bg-[#0d3129] group">
//       <span className="text-md text-white">
//         {/*  View Skill Gaps & Apply Jobs */}
//         (under development)
//       </span>
//       <ArrowRightIcon className="text-white w-5 h-5 group-hover:-rotate-45 transition-all duration-300 ease-in-out" />
//     </div>
//   </div>
// </div>;
