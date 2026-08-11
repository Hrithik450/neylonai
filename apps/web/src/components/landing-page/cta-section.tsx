"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import NeylonAI from "@/assets/images/neylon.jpg";
import { guminertMedium, guminertRegular } from "@/assets/fonts";
import { useSupportWidget } from "@neylonai/sdk/react";

export function CTASection() {
  const { open } = useSupportWidget();

  return (
    <section
      className={cn(
        guminertRegular.className,
        "my-4 md:my-16 px-3 md:px-5 xl:px-10 2xl:px-15 relative text-center overflow-hidden",
      )}
    >
      <Image
        src={NeylonAI}
        alt="neylon-image"
        className="w-24 h-24 mx-auto rounded-full mb-6"
        style={{ boxShadow: "0 8px 25px rgba(13, 49, 41, 0.25)" }}
      />

      <h1
        className={cn(
          "text-3xl md:text-5xl xl:text-6xl font-bold max-w-4xl mx-auto leading-tight",
          guminertMedium.className,
        )}
      >
        Start Capturing More Leads and Customer Requests.
      </h1>

      <div className="flex flex-col md:flex-row justify-center gap-4 my-6">
        <button
          type="button"
          onClick={() => open()}
          className="cursor-pointer border border-[#0d3129] bg-[#0d3129] hover:bg-white text-white hover:text-[#0d3129] shadow-sm rounded-full py-3 px-10 text-lg transition-all duration-300"
        >
          Try Live Demo
        </button>
      </div>
    </section>
  );
}
