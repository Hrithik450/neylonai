import { sfProBold, sfProMedium, sfProRegular } from "@/assets/fonts";
import { ChartBarMultiple } from "@/components/ui/charts/bar-chart";
import { Layers, Mic, SlidersHorizontal } from "lucide-react";
import ChatHistory from "@/components/chat-history";
import { CirclePlay } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import React from "react";

interface Model {
  name: string;
  logo: string;
}

const features = [
  {
    icon: <Layers className="w-6 h-6 text-purple-500" />,
    title: "Retrieval-Augmented Generation (RAG)",
    description:
      "We combine LLMs with domain-specific context for real-time, accurate responses.",
  },
  {
    icon: <Mic className="w-6 h-6 text-purple-500" />,
    title: "Custom Voice Assistants",
    description:
      "We create multilingual, conversational voice bots tailored to your workflows.",
  },
  {
    icon: <SlidersHorizontal className="w-6 h-6 text-purple-500" />,
    title: "Model Fine-Tuning",
    description:
      "We adapt foundation models with your own data to improve performance and relevance.",
  },
];

const models = [
  { name: "Open AI", logo: "/images/openai.svg" },
  { name: "Anthropic", logo: "/images/anthropic.svg" },
  { name: "Google Gemini", logo: "/images/googlegemini.svg" },
  { name: "Meta AI", logo: "/images/meta.svg" },
  { name: "Claude AI", logo: "/images/claude.svg" },
  { name: "Perplexity", logo: "/images/perplexity.svg" },
];

export function Partners({ models }: { models: Model[] }) {
  return (
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
  );
}

export default function FeatureCardList() {
  return (
    <div
      className={cn("flex items-center justify-center", sfProRegular.className)}
    >
      <div className="relative flex">
        <div className="bg-blue-500/70 absolute top-12 right-5 w-85 h-full rounded-lg" />

        <div className="relative top-2 left-5 z-10 bg-white rounded-2xl shadow-xl p-4 w-85">
          {features.map((feature, idx) => (
            <div key={idx} className="flex gap-4 py-4 border-b last:border-b-0">
              <div className="shrink-0">{feature.icon}</div>
              <div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="my-1 text-sm leading-snug text-gray-500">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WhyChooseUs() {
  return (
    <section className={cn("py-8 px-5 sm:px-20", sfProRegular.className)}>
      {/* Partner Section */}
      <Partners models={models} />

      {/* Main Component */}
      <h1
        className={cn("text-center text-7xl my-8 mt-18", sfProMedium.className)}
      >
        Why Choose AI Solutionz?
      </h1>
      <p className="text-center text-lg text-gray-500 max-w-4xl mx-auto my-4">
        We build AI solutions that work like your smartest employee — automating
        support, sales, and operations so your business runs 24/7. From web to
        multi-channel integration, we turn AI into measurable growth.
      </p>

      <div className="grid grid-cols-3 gap-6 mx-auto my-8">
        <div className="col-span-1 w-full bg-[#FFEEE8] rounded-2xl p-8 shadow-lg">
          <FeatureCardList />
        </div>

        <div className="col-span-1 p-6 w-full rounded-2xl overflow-hidden shadow-lg bg-[#E3FFCD]">
          <div className="flex justify-between items-center">
            <div>
              <h2 className={cn("text-lg", sfProBold.className)}>
                1250+ Hours Reclaimed Every Month
              </h2>
            </div>

            <button className="cursor-pointer text-md bg-[#64748B] text-white px-4 py-3 rounded-md shadow-sm flex items-center gap-2">
              <CirclePlay className="w-5 h-5" />
              Watch
            </button>
          </div>

          <div className="relative top-5 left-5">
            <ChartBarMultiple className="" />
          </div>
        </div>

        <div className="col-span-1 w-full bg-[#E3D0FF] rounded-2xl p-8 shadow-lg">
          <ChatHistory />
        </div>
      </div>
    </section>
  );
}
