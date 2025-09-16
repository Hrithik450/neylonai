import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { guminertMedium, guminertRegular } from "@/assets/fonts";
import HeroImage from "/public/images/hero_background_3.jpg";
import { ArrowDownRight, BadgeCheck, Cpu, Play } from "lucide-react";
import { ChartRadarLegend } from "@/components/ui/charts/radar-chart";
import WorkflowImage from "/public/images/workflow.webp";

export function Hero2() {
  return (
    <section className={cn(guminertRegular.className, "py-4 px-3 md:px-5")}>
      <div className="relative rounded-2xl overflow-hidden px-3 md:px-6 pt-20">
        <div className="absolute inset-0">
          <Image
            src={HeroImage}
            alt="hero-image"
            className="w-full h-full rotate-180"
          />
        </div>

        <div className="relative flex justify-start md:justify-center items-center">
          <div className="flex justify-center items-center gap-2 rounded-full p-1 px-2 border border-gray-400/90 shadow-xs">
            <BadgeCheck className="text-gray-600 bg-[#C0EB5D] rounded-full p-0.5 w-5 h-5 md:w-auto md:h-auto" />
            <span className="pr-1 text-sm md:text-base">
              Faster Global Payments
            </span>
          </div>
        </div>

        <h1
          className={cn(
            guminertMedium.className,
            "relative text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl max-w-5xl 2xl:max-w-[90rem] text-left md:text-center mx-auto my-4 leading-tight md:leading-16 lg:leading-18 xl:leading-22 2xl:leading-26"
          )}
        >
          Empowering You to Achieve Financial Freedom
        </h1>

        <p className="relative text-left md:text-center text-sm md:text-lg max-w-lg mx-auto text-gray-500">
          Perfect for fintech or consumer finance platforms aiming to simplify
          complex financial tasks for everyday users.
        </p>

        <div className="relative flex flex-col md:flex-row items-start md:items-center justify-center gap-3 md:gap-4 mt-6">
          <button className="flex items-center gap-2 bg-[#0E3228] text-white text-sm md:text-lg border border-gray-400 rounded-full p-2.5 px-8 cursor-pointer group overflow-hidden">
            Get Started
            <ArrowDownRight className="-rotate-90 group-hover:-rotate-45 transition-all duration-300 ease-in-out text-white w-5 md:w-6 h-5 md:h-6" />
          </button>

          <button className="flex items-center gap-2 bg-[#E9E9E7] text-sm md:text-lg border border-gray-400 rounded-full p-2.5 px-7 cursor-pointer group">
            <Play className="group-hover:-rotate-15 transition-all duration-300 ease-in-out w-5 md:w-6 h-5 md:h-6" />
            Watch Demo
          </button>
        </div>

        <div className="my-8 relative grid grid-cols-1 md:grid-cols-4 xl:grid-cols-3 items-end gap-4 xl:gap-8">
          <div className="md:col-span-2 xl:col-span-1 relative flex flex-col md:flex-row items-start md:items-center p-4 md:p-3 border border-gray-400 rounded-3xl h-auto md:h-75 xl:h-65 w-full shadow-md hover:rotate-2 transition-all duration-150 ease-in-out bg-[linear-gradient(to_bottom,rgb(230,250,217)_0%,rgb(255,255,255)_100%)]">
            <div className="md:px-2 py-4 bg-transparent rounded-xl flex-1 flex flex-col h-full gap-2 justify-center items-start md:items-center group">
              <Cpu className="w-15 h-15 group-hover:scale-110 group-hover:rotate-5 transition-all duration-150 ease-in-out" />
              <h1 className="text-4xl font-semibold">99.9%</h1>
              <p className="text-md text-center">Accuracy & Reliability</p>
            </div>

            <div className="flex-1 flex flex-col gap-2 justify-around items-start">
              <h3 className="text-xl max-w-[270px] font-semibold">
                Delivering Unmatched AI Solutions for Businesses.
              </h3>

              <p className="text-base text-gray-500">
                Our AI models are built for precision and reliability, ensuring
                actionable insights that drive real business impact.
              </p>
            </div>
          </div>

          <div className="md:col-span-2 xl:col-span-1 relative border border-gray-400 rounded-3xl overflow-hidden h-75 w-full shadow-md hover:rotate-2 transition-all duration-150 ease-in-out">
            <Card className="absolute inset-0 w-full h-full gap-0 space-y-1 bg-[linear-gradient(to_bottom,rgb(250,244,215)_0%,rgb(255,255,255)_100%)]">
              <CardHeader className="items-center px-3">
                <CardTitle className="absolute top-3 left-1/2 -translate-x-1/2 w-full text-center z-10 text-lg xl:text-xl mb-2 text-black/80 font-bold">
                  One Assistant, Unmatched metrics
                </CardTitle>
              </CardHeader>

              <ChartRadarLegend />
            </Card>
          </div>

          <div className="relative md:col-span-4 xl:col-span-1 overflow-hidden border border-gray-400 rounded-3xl h-auto md:h-75 xl:h-65 w-full shadow-md hover:rotate-2 transition-all duration-150 ease-in-out">
            <div className="absolute top-2 md:top-4 left-4 z-10 text-lg md:text-xl text-black/80 font-bold">
              Agent Workflow
            </div>

            <Image
              className="w-full h-full object-fit"
              src={WorkflowImage}
              alt="workflow-img"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
