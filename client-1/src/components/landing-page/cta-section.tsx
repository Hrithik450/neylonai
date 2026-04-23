"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import NeylonAI from "@/assets/images/neylon.jpg";
import { guminertMedium, guminertRegular } from "@/assets/fonts";
import {
  TabType,
  useNavigationStore,
  useSupportWidgetToggleStore,
} from "@/store/store";

export function CTASection() {
  const { switchTab } = useNavigationStore();
  const { setIsOpen } = useSupportWidgetToggleStore();

  return (
    <section
      className={cn(
        guminertRegular.className,
        "my-4 md:my-16 px-3 md:px-5 xl:px-10 2xl:px-15 relative text-center overflow-hidden"
      )}
    >
      {/* <div className="absolute inset-0 bg-gradient-to-b from-[#0d3129]/10 via-transparent to-white pointer-events-none" /> */}

      {/* Logo */}
      <Image
        src={NeylonAI}
        alt="neylon-image"
        className="w-24 h-24 mx-auto rounded-full mb-6"
        style={{ boxShadow: "0 8px 25px rgba(13, 49, 41, 0.25)" }}
      />

      {/* Heading */}
      <h1
        className={cn(
          "text-3xl md:text-5xl xl:text-6xl font-bold max-w-4xl mx-auto leading-tight",
          guminertMedium.className
        )}
      >
        Power Conversations. Amplify Intelligence.
      </h1>

      {/* Subheading */}
      <p className="text-center text-gray-700 max-w-xl mx-auto text-lg my-5 lg:my-6">
        Experience the future of customer engagement with{" "}
        <span className="font-semibold text-[#0d3129]">Neylon AI</span> — where
        human connection meets intelligent automation.
      </p>

      {/* CTA Buttons */}
      <div className="flex flex-col md:flex-row justify-center gap-4">
        <button
          onClick={() => {
            setIsOpen(true);
            switchTab(TabType.Contact);
          }}
          className="cursor-pointer border border-[#0d3129] bg-[#0d3129] hover:bg-white text-white hover:text-[#0d3129] shadow-sm rounded-full py-3 px-10 text-lg transition-all duration-300"
        >
          Book a Demo
        </button>
      </div>
    </section>
  );
}
