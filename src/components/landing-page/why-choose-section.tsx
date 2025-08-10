import { ChartAreaDefault } from "@/components/ui/charts/area-chart";
import { ChartBarMultiple } from "@/components/ui/charts/bar-chart";
import { ChartRadialText } from "@/components/ui/charts/radial-chart";
import ChatHistory from "@/components/chat-history";
import FeatureCardList from "@/components/feature-card";
import Image from "next/image";
import React from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CirclePlay } from "lucide-react";
import { cn } from "@/lib/utils";
import { sfProBold, sfProMedium } from "@/assets/fonts";

export function WhyChooseUs() {
  const models = React.useMemo(() => {
    return [
      { name: "Open AI", logo: "/images/openai.svg" },
      { name: "Anthropic", logo: "/images/anthropic.svg" },
      { name: "Google Gemini", logo: "/images/googlegemini.svg" },
      { name: "Meta AI", logo: "/images/meta.svg" },
      { name: "Claude AI", logo: "/images/claude.svg" },
      { name: "Perplexity", logo: "/images/perplexity.svg" },
    ];
  }, []);

  return (
    <section className={cn("py-8 px-5 sm:px-20", sfProMedium.className)}>
      {/* Partner Section */}
      <div>
        <h2 className="text-center text-gray-600 text-xl font-medium my-6">
          We leverage leading AI models to power your innovation
        </h2>

        <div className="flex flex-wrap justify-center items-center gap-8">
          {models.map((model) => (
            <div
              key={model.name}
              className="flex justify-around items-center gap-2 mx-4"
            >
              <Image src={model.logo} alt={model.name} width={50} height={50} />
              <span className="text-gray-800 font-medium text-2xl">
                {model.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Component */}
      <h1 className="text-center text-7xl my-8 mt-18">
        Why Choose AI Solutionz?
      </h1>
      <p className="text-center text-lg text-gray-500 max-w-4xl mx-auto my-4">
        We build AI solutions that work like your smartest employee — automating
        support, sales, and operations so your business runs 24/7. From web to
        multi-channel integration, we turn AI into measurable growth.
      </p>

      <div className="grid grid-cols-3 gap-6 mx-auto my-8">
        <div className="col-span-1 w-full bg-[#FFF0EB] rounded-2xl p-8 shadow-lg">
          <ChatHistory />
        </div>
        <div className="p-6 col-span-2 w-full rounded-2xl overflow-hidden shadow-lg bg-[#F4FAE4]">
          <div className="flex justify-between items-center">
            <div>
              <h2 className={cn("text-lg", sfProBold.className)}>
                1250+ Hours Reclaimed Every Month
              </h2>
              <p className="text-md">
                With AI Solutionz, every hour saved is reinvested in growth,
                innovation, and customer delight.
              </p>
            </div>

            <button className="cursor-pointer text-sm bg-[#64748B] text-white px-4 py-3 rounded-md shadow-sm flex items-center gap-2">
              <CirclePlay className="w-5 h-5" />
              How It Works ?
            </button>
          </div>

          <div className="relative top-5 left-5">
            <ChartBarMultiple className="" />
          </div>
        </div>

        <div className="p-6 col-span-2 w-full rounded-2xl overflow-hidden shadow-lg bg-[#F4ECFF]">
          <div className="flex justify-between items-center">
            <div>
              <h2 className={cn("text-lg", sfProBold.className)}>
                500+ Human Workdays Saved Every Month
              </h2>
              <p className="text-md">
                Based on $20.83/hr, AI assistants free up time for productivity,
                growth, and innovation.
              </p>
            </div>

            <button className="cursor-pointer text-sm bg-[#64748B] text-white px-4 py-3 rounded-md shadow-sm flex items-center gap-2">
              <CirclePlay className="w-5 h-5" />
              Discover the Process
            </button>
          </div>

          <div className="relative top-5 left-5">
            <ChartAreaDefault className="" />
          </div>
        </div>

        <div className="col-span-1 w-full bg-[#EEF9FF] rounded-2xl p-8 shadow-lg">
          <FeatureCardList />
        </div>
      </div>
    </section>
  );
}
