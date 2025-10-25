"use client";

import { guminertRegular } from "@/assets/fonts";
import { cn } from "@/lib/utils";
import Image from "next/image";
import React from "react";

interface BlogPost {
  title: string;
  date: string;
  image: string;
  sections: {
    heading?: string;
    content: string;
    quote?: string;
    points?: string[];
  }[];
}

const blogPost: BlogPost = {
  title: "Immerse in the Digital Art Extravaganza",
  date: "July 12, 2023",
  image:
    "https://images.unsplash.com/photo-1599522336242-0db868a98cb1?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1332",
  sections: [
    {
      heading: "The New Age of Creativity",
      content:
        "In the era of digital expression, artists are pushing the boundaries of traditional media, using the endless possibilities offered by technology. Digital art is not just a medium—it’s a **revolution**. It blends imagination, code, and emotion, creating experiences that transcend the physical canvas.",
      quote:
        "Digital art is where pixels meet poetry — and innovation becomes emotion.",
    },
    {
      heading: "Digital Art Knows No Limits",
      content:
        "From immersive virtual reality to mind-bending augmented reality installations, digital art shatters creative boundaries. It invites audiences to step beyond observation and into **interaction**—where art responds, evolves, and even learns.",
      points: [
        "🎨 Artists use code, algorithms, and AI to shape new visual dimensions.",
        "🌐 Audiences participate in living, breathing digital ecosystems.",
        "🚀 The blend of art and technology is redefining storytelling itself.",
      ],
    },
    {
      heading: "A Glimpse Into the Future",
      content:
        "As innovation accelerates, digital art continues to evolve—fueled by blockchain, machine learning, and generative AI. What began as pixels on a screen is now a movement reshaping culture, identity, and creativity across the globe.",
      quote:
        "In the future, every artist will be part engineer — and every engineer, part artist.",
    },
  ],
};

export default function CustomerServiceAssistantBlog() {
  return (
    <section
      className={cn(
        "relative max-w-480 mx-auto pt-24 md:pt-30 pb-10 md:px-14 flex justify-start items-start bg-gray-50 text-gray-800",
        guminertRegular.className
      )}
    >
      <div className="max-w-5xl w-full p-6 md:p-10 space-y-6 overflow-hidden">
        <div className="flex flex-col items-start gap-1">
          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 leading-snug">
            {blogPost.title}
          </h1>
          <p className="text-left text-black./90 text-md md:text-lg">
            <strong>Last Updated:</strong> {blogPost.date}
          </p>
        </div>

        <div>
          <Image
            width={300}
            height={150}
            alt="Blog visual"
            src={blogPost.image}
            className="w-full rounded-xl object-cover shadow-md"
          />
        </div>

        <div className="space-y-10">
          {blogPost.sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              {section.heading && (
                <h2 className="text-2xl pl-3 font-semibold text-black border-l-4 border-black">
                  {section.heading}
                </h2>
              )}
              <p className="text-gray-700 leading-relaxed text-sm md:text-base">
                {section.content}
              </p>

              {section.quote && (
                <blockquote className="text-sm md:text-base border-l-4 border-black/60 pl-4 italic text-gray-600 bg-black/10 rounded-md py-3 px-4">
                  “{section.quote}”
                </blockquote>
              )}

              {section.points && section.points.length > 0 && (
                <ul className="list-disc list-inside space-y-2 text-gray-700">
                  {section.points.map((point, i) => (
                    <li
                      key={i}
                      className="leading-relaxed text-sm md:text-base"
                    >
                      {point}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center border-t border-gray-200">
          <p className="text-sm md:text-base text-gray-500">
            Thanks for reading. Stay curious, stay inspired ✨
          </p>
        </div>
      </div>
    </section>
  );
}
