"use client";

import React from "react";
import { useInputStore } from "@/store/store";
import { CircleChevronLeft, CircleChevronRight } from "lucide-react";

// const suggestions = [
//   "What are the top skills in demand for my role right now?",
//   "How does my skill set compare to other Data Analysts in India?",
//   "Show me which skills I’m missing for a Data Scientist job.",
//   "Can you recommend a 4-week learning roadmap for me?",
//   "What roles match best with my current profile?",
//   "Which tools should I learn to increase my hiring chances?",
//   "What percentage of jobs in my domain require Python this week?",
//   "Am I above or below the average candidate for my target role?",
//   "Show me how my peers are performing in similar roles.",
//   "How can I close my skill gap faster?",
//   "Which certifications will help me stand out right now?",
//   "Can you track my progress compared to other users?",
//   "What are the most common keywords in current job listings for my field?",
//   "What skills should I learn next to boost my score?",
//   "How has demand for my role changed in the past month?",
//   "Show me trending roles related to my profile.",
//   "Am I ready to apply for top-tier companies?",
//   "What’s my job-readiness score this week?",
//   "Who’s leading the leaderboard in my domain?",
//   "Can you suggest personalized jobs based on my profile?",
//   "Which skills give the highest salary boost this month?",
//   "Show me companies actively hiring for my skills.",
//   "What’s the fastest way to reach 80% skill coverage for my dream role?",
//   "Which skills have become less relevant recently?",
//   "How can I stay ahead of my peers in the next 30 days?",
// ];

const suggestions = [
  "What are the main AI services Neylon-AI currently offers?",
  "Which industries does Neylon-AI primarily serve right now?",
  "Show me our enterprise AI solutions and their key benefits.",
  "How does the Support Widget improve client engagement?",
  "What’s included in the client onboarding process?",
  "Can you summarize our B2B vs B2C offerings?",
  "What’s unique about Neylon-AI’s multi-agent orchestration?",
  "Show me recent updates to our Customer Service AI Agent.",
  "What differentiates Neylon-AI from other AI agencies?",
  "Can you show me examples of enterprise automation use cases?",
  "What are the current active features in our analytics dashboard?",
  "How do we ensure enterprise-grade data security and compliance?",
  "What’s our process for developing a custom AI solution?",
  "Which industries are showing the most demand for AI right now?",
  "Show me how a user experiences Neylon-AI’s B2C flow.",
  "Which integrations are most common among enterprise clients?",
  "How can clients contact or book an appointment with us?",
  "What are our pricing and consultation steps?",
  "Summarize Hruthik M’s role and background as CEO.",
  "Where can users find our case studies and insights?",
];

export function SuggestionBar() {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const { input, setInput } = useInputStore();

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  const filterSuggestions = React.useMemo(() => {
    if (!input.trim()) return suggestions;
    const query = input.toLowerCase();
    return suggestions
      .filter((s) => s.toLowerCase().includes(query))
      .sort(
        (a, b) =>
          a.toLowerCase().indexOf(query) - b.toLowerCase().indexOf(query)
      );
  }, [input]);

  return (
    <div className="flex items-center w-full space-x-1 rounded-full">
      <div ref={scrollRef} className="flex-1 scrollbar-hide overflow-x-auto">
        <div className="flex space-x-1">
          {filterSuggestions.map((suggestion, idx) => (
            <button
              key={idx}
              className="shrink-0 px-3 py-px text-sm border border-gray-400 bg-gray-100 hover:bg-gray-100/80 text-black hover:cursor-pointer rounded-full shadow-sm transition-colors"
              onClick={() => setInput(suggestion)}
            >
              {suggestion}
            </button>
          ))}

          {filterSuggestions.length === 0 && (
            <span className="text-gray-500 text-sm italic px-3">
              No suggestions found...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
