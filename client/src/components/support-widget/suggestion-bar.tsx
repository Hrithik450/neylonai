"use client";

import React from "react";
import { useInputStore } from "@/store/store";
import { CircleChevronLeft, CircleChevronRight } from "lucide-react";

const suggestions = [
  "What are the top skills in demand for my role right now?",
  "How does my skill set compare to other Data Analysts in India?",
  "Show me which skills I’m missing for a Data Scientist job.",
  "Can you recommend a 4-week learning roadmap for me?",
  "What roles match best with my current profile?",
  "Which tools should I learn to increase my hiring chances?",
  "What percentage of jobs in my domain require Python this week?",
  "Am I above or below the average candidate for my target role?",
  "Show me how my peers are performing in similar roles.",
  "How can I close my skill gap faster?",
  "Which certifications will help me stand out right now?",
  "Can you track my progress compared to other users?",
  "What are the most common keywords in current job listings for my field?",
  "What skills should I learn next to boost my score?",
  "How has demand for my role changed in the past month?",
  "Show me trending roles related to my profile.",
  "Am I ready to apply for top-tier companies?",
  "What’s my job-readiness score this week?",
  "Who’s leading the leaderboard in my domain?",
  "Can you suggest personalized jobs based on my profile?",
  "Which skills give the highest salary boost this month?",
  "Show me companies actively hiring for my skills.",
  "What’s the fastest way to reach 80% skill coverage for my dream role?",
  "Which skills have become less relevant recently?",
  "How can I stay ahead of my peers in the next 30 days?",
];

export function SuggestionBar() {
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const { input, setInput } = useInputStore();

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

  const scroll = (direction: "right" | "left") => {
    const scrollAmount = 200;
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="flex items-center w-full space-x-1 rounded-full px-1">
      {filterSuggestions.length > 0 && (
        <button
          onClick={() => scroll("left")}
          className="flex-shrink-0 cursor-pointer"
        >
          <CircleChevronLeft className="w-5 h-5" />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex-1 rounded-xl scrollbar-hide overflow-x-auto"
      >
        <div className="flex space-x-1">
          {filterSuggestions.map((suggestion, idx) => (
            <button
              key={idx}
              className="flex-shrink-0 px-3 py-0.25 text-sm border border-gray-400 bg-gray-200 hover:bg-gray-100 text-black hover:cursor-pointer rounded-full shadow-sm transition-colors"
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

      {filterSuggestions.length > 0 && (
        <button
          onClick={() => scroll("right")}
          className="flex-shrink-0 cursor-pointer"
        >
          <CircleChevronRight className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
