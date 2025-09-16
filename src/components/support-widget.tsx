"use client";

import {
  House,
  MessageSquareText,
  MessageCircleQuestionMark,
} from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import { guminertRegular } from "@/assets/fonts";
import { Home } from "@/components/support-widget/widget-home";
import { useSupportWidgetToggleStore } from "@/store/store";

/* -------------------------------------------------------------------------- */
/*                                Tab Config                                  */
/* -------------------------------------------------------------------------- */
interface TabConfig {
  label: string;
  icon: React.ReactNode;
  component: React.FC;
}

const TAB_CONFIG: TabConfig[] = [
  { icon: <House className="w-6 h-6" />, label: "Home", component: Home },
  {
    icon: <MessageSquareText className="w-6 h-6" />,
    label: "Messages",
    component: () => <div>Hello, World</div>,
  },
  {
    icon: <MessageCircleQuestionMark className="w-6 h-6" />,
    label: "Help",
    component: Home,
  },
];

/* -------------------------------------------------------------------------- */
/*                           Typing Animation Hook                            */
/* -------------------------------------------------------------------------- */
export function useTypingAnimation(texts: string[], introTextFull: string) {
  const [introText, setIntroText] = React.useState("");
  const [displayText, setDisplayText] = React.useState("");

  const typingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const introIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const nextTextTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const clearAll = React.useCallback(() => {
    if (typingIntervalRef.current) clearInterval(typingIntervalRef.current);
    if (introIntervalRef.current) clearInterval(introIntervalRef.current);
    if (nextTextTimeoutRef.current) clearTimeout(nextTextTimeoutRef.current);
  }, []);

  const loopTexts = React.useCallback(
    (text: string, index: number) => {
      let i = -1;
      typingIntervalRef.current = setInterval(() => {
        setDisplayText((prev) => prev + text.charAt(i));
        i++;
        if (i === text.length) {
          clearInterval(typingIntervalRef.current!);
          nextTextTimeoutRef.current = setTimeout(() => {
            setDisplayText("");
            const nextIndex = (index + 1) % texts.length;
            loopTexts(texts[nextIndex], nextIndex);
          }, 1000);
        }
      }, 70);
    },
    [texts]
  );

  const startAnimation = React.useCallback(() => {
    clearAll();
    setIntroText("");
    setDisplayText("");
    let i = 0;
    introIntervalRef.current = setInterval(() => {
      setIntroText(introTextFull.slice(0, i + 1));
      i++;
      if (i === introTextFull.length) {
        clearInterval(introIntervalRef.current!);
        loopTexts(texts[0], 0);
      }
    }, 70);
  }, [introTextFull, texts, loopTexts, clearAll]);

  React.useEffect(() => clearAll, [clearAll]);

  return { introText, displayText, startAnimation };
}

/* -------------------------------------------------------------------------- */
/*                              Main Component                                */
/* -------------------------------------------------------------------------- */
export function SupportWidget() {
  const { isOpen } = useSupportWidgetToggleStore();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [visited, setVisited] = React.useState<Set<number>>(new Set([0]));

  function handleTabChange(i: number) {
    setActiveIndex(i);
    setVisited((prev) => new Set(prev).add(i)); // mark as visited
  }

  return (
    <div
      className={cn(
        guminertRegular.className,
        "fixed max-md:inset-0 max-md:bottom-0 overflow-y-auto",
        "md:bottom-20 md:right-5",
        "2xl:right-[max(1.2rem,calc((100vw-120rem)/2+2rem))]",
        "w-full md:min-w-sm max-w-sm",
        "md:h-[65vh] lg:h-[82vh] max-h-[750px] z-50",
        "bg-[linear-gradient(to_bottom,rgb(144,238,144)_0%,white_100%)]",
        "border border-gray-400/40 shadow-2xl sm:rounded-2xl p-2 sm:p-3 flex flex-col",
        "origin-bottom-right transition-all duration-300 transform",
        isOpen
          ? "opacity-100 scale-100"
          : "opacity-0 scale-0 pointer-events-none"
      )}
    >
      {/* Active Screen */}
      <div className="relative flex-1 w-full h-full overflow-x-hidden overflow-y-auto scrollbar-hide">
        {TAB_CONFIG.map((tab, i) => {
          const Screen = tab.component;
          const offset = (i - activeIndex) * 100; // how far each screen should slide
          return (
            <div
              key={tab.label}
              className="absolute inset-0 w-full h-full transition-transform duration-300"
              style={{ transform: `translateX(${offset}%)` }}
            >
              {visited.has(i) && i === activeIndex && <Screen />}
            </div>
          );
        })}
      </div>

      {/* Navigation */}
      <nav className="border-t flex justify-around pt-3">
        {TAB_CONFIG.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => handleTabChange(i)}
            className={cn(
              "flex flex-col items-center cursor-pointer",
              i === activeIndex ? "text-purple-600" : "text-gray-500"
            )}
          >
            {tab.icon}
            <span className="text-xs sm:text-sm">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
