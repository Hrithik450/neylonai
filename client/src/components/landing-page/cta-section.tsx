import Image from "next/image";
import { cn } from "@/lib/utils";
import { guminertMedium, guminertRegular } from "@/assets/fonts";
import NeylonAI from "@/assets/images/neylon.jpg";

export function CTASection() {
  return (
    <section
      className={cn(guminertRegular.className, "pt-2 md:pt-8 px-4 md:px-8")}
    >
      <Image
        src={NeylonAI}
        alt="neylon-image"
        className="w-23 h-23 rounded-full mx-auto my-8"
        style={{ boxShadow: "0 4px 12px rgb(0,0,0)" }}
      />

      <h1
        className={cn(
          "text-3xl lg:text-5xl xl:text-6xl max-w-2xl lg:max-w-4xl xl:max-w-6xl leading-tight md:leading-12 xl:leading-17 mx-auto text-center",
          guminertMedium.className
        )}
      >
        Ready To Elevate Your Customer Conversations?
      </h1>

      <p className="text-center max-w-lg mx-auto text-md mt-5 mb-7">
        Start Your Free Trial Or Book A Demo Call With Our Experts To See
        AISolutionz AI In Action
      </p>

      <div className="flex flex-col px-4 md:px-0 md:flex-row justify-start md:justify-center gap-4">
        <button className="bg-[#0d3129] text-white shadow-sm rounded-full p-3 px-10 cursor-pointer text-md md:text-lg">
          Get Started Free
        </button>
        <button className="shadow-sm border border-gray-500 rounded-full p-3 px-10 cursor-pointer text-md md:text-lg">
          Book a Demo
        </button>
      </div>
    </section>
  );
}
