"use client";

import React, { useRef, useState, useEffect } from "react";
import Image from "next/image";
import { Link as ScrollLink, scroller } from "react-scroll";
import { motion } from "framer-motion";
import { ArrowDownRight, BadgeCheck, Cpu, Play } from "lucide-react";

import HeroImage from "@/assets/images/hero_background_3.jpg";
import IphoneFrameImage from "@/assets/images/iphone-frame.png";

import { WidgetHome, WidgetHostProvider, useWidgetToggleStore } from "@neylonai/sdk/react";

import { cn } from "@/lib/utils";
import { guminertBold, guminertMedium, guminertRegular } from "@/assets/fonts";
import { Card, CardContent, CardHeader, CardTitle } from "@neylonai/ui";

const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

const wordVariant = {
  hidden: {
    opacity: 0,
    y: 12,
    filter: "blur(8px)",
  },
  visible: (delay: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: "easeOut" as const, delay },
  }),
};

const EYEBROW_WORDS = "Pure Engineering · India".split(" ");
const H1_WORDS: { text: string; gradient?: true }[] = [
  { text: "Your" },
  { text: "Technical" },
  { text: "Execution", gradient: true },
  { text: "Partner" },
];
const SUBTITLE_WORDS =
  "Helping founders and engineering teams architect, build, improve, and scale reliable software products through modern engineering, AI systems, and production-ready infrastructure.".split(
    " ",
  );

const EYEBROW_STAGGER = 0.04;
const H1_STAGGER = 0.045;
const SUBTITLE_STAGGER = 0.022;

const eyebrowEnd = (EYEBROW_WORDS.length - 1) * EYEBROW_STAGGER;
const h1Start = eyebrowEnd + 0.08;
const h1End = h1Start + (H1_WORDS.length - 1) * H1_STAGGER;
const subtitleStart = h1End + 0.1;
const buttonsDelay =
  subtitleStart + (SUBTITLE_WORDS.length * SUBTITLE_STAGGER) / 2;

function eyebrowDelay(i: number) {
  return i * EYEBROW_STAGGER;
}
function h1Delay(i: number) {
  return h1Start + i * H1_STAGGER;
}
function subtitleDelay(i: number) {
  return subtitleStart + i * SUBTITLE_STAGGER;
}

function scrollToSection(section: string) {
  scroller.scrollTo(section, {
    duration: 300,
    smooth: true,
    offset: 0,
  });
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.05 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

function fadeIn(
  visible: boolean,
  delay: number,
  duration = 650,
): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    filter: visible ? "blur(0px)" : "blur(8px)",
    transform: visible ? "translateY(0)" : "translateY(12px)",
    transition: `opacity ${duration}ms ${EASE}, filter ${duration}ms ${EASE}, transform ${duration}ms ${EASE}`,
    transitionDelay: visible ? `${delay}ms` : "0ms",
  };
}

export function Hero() {
  const { setIsOpen } = useWidgetToggleStore();
  const { ref, visible } = useReveal();

  return (
    <section
      id="home"
      className={cn(
        guminertRegular.className,
        "py-4 px-3 md:px-5 h-max md:h-310 xl:h-290 overflow-hidden",
      )}
    >
      <div
        ref={ref}
        className="relative rounded-2xl overflow-hidden px-3 md:px-6 pt-26 md:pt-34"
      >
        <div className="absolute inset-0">
          <Image
            src={HeroImage}
            alt="hero-image"
            className="w-full h-full rotate-180"
          />
        </div>

        {/* Eyebrow */}
        <div className="relative flex justify-start md:justify-center items-center mb-4">
          <p className="font-medium uppercase text-gray-600 text-sm tracking-widest">
            {EYEBROW_WORDS.map((word, i) => (
              <motion.span
                key={i}
                custom={eyebrowDelay(i)}
                variants={wordVariant}
                initial="hidden"
                animate="visible"
                className="inline-block mr-[0.3em] last:mr-0"
              >
                {word}
              </motion.span>
            ))}
          </p>
        </div>

        {/* Heading */}
        <h1
          className={cn(
            guminertMedium.className,
            "relative text-[1.5rem] md:text-5xl lg:text-6xl xl:text-7xl max-w-7xl 2xl:max-w-360 text-left md:text-center mx-auto my-4 leading-tight md:leading-16 lg:leading-18 xl:leading-20",
          )}
        >
          {H1_WORDS.map((word, i) => (
            <motion.span
              key={i}
              custom={h1Delay(i)}
              variants={wordVariant}
              initial="hidden"
              animate="visible"
              className={cn(
                "inline-block mr-[0.25em] last:mr-0",
                word.gradient
                  ? "bg-linear-to-r from-[#050c0a] via-[#0d3129] to-[#007a63] bg-clip-text text-transparent"
                  : "text-[#0E3228]",
              )}
            >
              {word.text}
            </motion.span>
          ))}
        </h1>

        {/* Subtitle */}
        <p className="relative text-left md:text-center text-sm md:text-lg max-w-2xl mx-auto text-gray-500">
          {SUBTITLE_WORDS.map((word, i) => (
            <motion.span
              key={i}
              custom={subtitleDelay(i)}
              variants={wordVariant}
              initial="hidden"
              animate="visible"
              className="inline-block mr-[0.28em] last:mr-0"
            >
              {word}
            </motion.span>
          ))}
        </p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: "easeOut", delay: buttonsDelay }}
          className="relative flex items-center justify-start md:justify-center gap-3 md:gap-4 mt-6"
        >
          <button
            onClick={() => {
              setIsOpen(true);
            }}
            className="flex items-center gap-2 bg-[#0E3228] text-white text-sm md:text-lg border border-gray-400 rounded-full p-2.5 px-4 md:px-8 cursor-pointer group overflow-hidden"
          >
            Start Free
            <ArrowDownRight className="-rotate-90 group-hover:-rotate-45 transition-all duration-300 ease-in-out text-white w-4 h-4 md:w-6 md:h-6" />
          </button>

          <button
            className="bg-[#E9E9E7] text-sm md:text-lg border border-gray-400 rounded-full p-2.5 px-4 md:px-8 cursor-pointer group"
            onClick={() => scrollToSection("features")}
          >
            <span className="flex items-center gap-2">
              <Play className="group-hover:-rotate-15 transition-all duration-300 ease-in-out w-4 h-4 md:w-6 md:h-6" />
              See Features
            </span>
          </button>
        </motion.div>

        <div className="relative max-w-360 mx-auto mt-10 max-md:mt-48 max-md:mb-26">
          <div className="relative max-w-xs md:max-w-md mx-auto h-full flex-center">
            {/* Iphone Frame */}
            <div className="relative w-full h-full z-20">
              <Image
                className="bg-transparent w-full h-full object-cover"
                src={IphoneFrameImage}
                alt="iphone-frame"
              />
            </div>

            {/* Frame Content */}
            <div className="absolute w-full h-full z-10">
              <div className="px-3 md:px-6 pt-12 md:pt-16 bg-[linear-gradient(to_bottom,rgb(230,250,217)_0%,rgb(255,255,255)_100%)] pointer-events-none w-[95%] aspect-789/1650 mx-auto object-cover rounded-[2.75rem] lg:rounded-[3rem] xl:rounded-[3.70rem] 2xl:rounded-[4.5rem] overflow-hidden">
                <WidgetHostProvider
                  config={{
                    branding: {
                      name: "Neylon AI",
                      logoUrl: "/neylon.jpg",
                      primaryColor: "#0E3228",
                    },
                  }}
                >
                  <WidgetHome />
                </WidgetHostProvider>
              </div>
            </div>
          </div>

          {/* Supporting Card-1 */}
          <div className="absolute -top-40 md:top-10 lg:top-15 -right-2.5 lg:right-0 2xl:right-30 z-50">
            <div className="relative flex flex-col xl:flex-row items-center gap-0 xl:gap-4 p-4 lg:p-3 border border-gray-400 rounded-3xl h-auto md:h-60 xl:h-65 max-w-60 md:max-w-sm xl:max-w-lg w-full shadow-md hover:rotate-2 transition-all duration-150 ease-in-out bg-[linear-gradient(to_bottom,rgb(240,237,255)_0%,rgb(255,255,255)_100%)]">
              <div className="md:px-2 py-4 md:py-2 bg-transparent rounded-xl flex flex-col h-full gap-2 justify-center items-center group">
                <Cpu className="w-15 h-15 group-hover:scale-110 group-hover:rotate-5 transition-all duration-150 ease-in-out" />
                <h1 className="text-4xl font-semibold">4-10 Hrs</h1>
                <p className="text-md text-center">Average Setup Time</p>
              </div>

              <div className="flex-1 flex flex-col gap-2 justify-around items-start">
                <h3 className="text-sm md:text-base xl:text-xl max-w-67.5 max-xl:text-center font-semibold">
                  Get Your AI Agent Live In Hours, Not Weeks.
                </h3>

                <p className="max-xl:hidden text-sm md:text-base text-gray-500">
                  Train on your website, configure your business information,
                  and start answering customer questions the same day.
                </p>
              </div>
            </div>
          </div>

          {/* Supporting Card-2 */}
          <div className="absolute -bottom-20 md:bottom-80 lg:bottom-90 -left-2.5 lg:left-0 2xl:left-15 z-50">
            <div className="relative border border-gray-400 rounded-3xl overflow-hidden h-60 md:h-65 max-w-sm md:max-w-lg w-60 md:w-[20rem] xl:w-md shadow-md hover:rotate-2 transition-all duration-150 ease-in-out">
              <Card className="absolute inset-0 w-full h-full bg-[linear-gradient(to_bottom,rgb(250,244,215)_0%,rgb(255,255,255)_100%)] py-4 lg:py-4 xl:py-8 px-2 gap-0">
                <CardHeader className="pb-1 md:pb-2 px-0">
                  <CardTitle className="text-center text-[0.9rem] md:text-lg xl:text-xl font-bold text-black/80">
                    Multiple Business Outcomes.
                  </CardTitle>
                </CardHeader>

                <CardContent className="flex-1 flex items-center justify-center px-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2 md:gap-y-3 md:gap-x-4 w-full max-w-sm">
                    {[
                      "Lead Capture",
                      "Customer Support",
                      "FAQ Automation",
                      "Support Requests",
                      "Website Engagement",
                      "Appointment Booking",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 text-sm md:text-base font-medium"
                      >
                        <span className="text-green-600">✓</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
