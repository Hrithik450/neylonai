import { sfProRegular } from "@/assets/fonts";
import { cn } from "@/lib/utils";
import { Layers, Mic, SlidersHorizontal } from "lucide-react";

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

export default function FeatureCardList() {
  return (
    <div
      className={cn("flex items-center justify-center", sfProRegular.className)}
    >
      <div className="relative flex">
        <div className="bg-blue-500/70 absolute top-15 right-5 w-85 h-full rounded-lg" />

        <div className="relative top-5 left-5 z-10 bg-white rounded-2xl shadow-xl p-4 w-85">
          {features.map((feature, idx) => (
            <div key={idx} className="flex gap-4 py-4 border-b last:border-b-0">
              <div className="flex-shrink-0">{feature.icon}</div>
              <div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
