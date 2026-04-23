import React from "react";
import Link from "next/link";
import { Youtube, Linkedin, Instagram, Twitter, Mail } from "lucide-react";
import HeroBackgrpund from "@/assets/images/hero_background_3.jpg";
import { AvatarGroup } from "@/components/avatar-group";
import demoVideo from "../../../videos/demo.mp4";
import { Badge } from "@/components/ui/badge";
import { sfProRegular } from "@/assets/fonts";
import NextVideo from "next-video";
import { cn } from "@/lib/utils";
import Image from "next/image";

const socialLinks = [
  { label: "Youtube", url: "", icon: Youtube },
  { label: "Linkedin", url: "", icon: Linkedin },
  { label: "Instagram", url: "", icon: Instagram },
  { label: "Twitter", url: "", icon: Twitter },
  { label: "Email", url: "", icon: Mail },
];

export function Hero() {
  return (
    <section
      className={cn(
        "relative px-5 sm:px-20 pt-44 min-h-dvh h-full w-full",
        sfProRegular.className
      )}
    >
      <div className="absolute inset-0">
        <Image
          className="w-full h-full"
          alt="background-image"
          src={HeroBackgrpund}
        />
      </div>

      <div className="relative grid grid-cols-12">
        <p
          className={cn(
            "col-start-1 col-span-7 row-start-1 text-4xl md:text-5xl lg:text-7xl xl:text-[6.25rem] leading-26",
            sfProRegular.className
          )}
        >
          Transform with
        </p>

        <Badge
          variant="outline"
          className="col-span-2 col-start-8 2xl:col-start-7 row-span-1 row-start-1 self-baseline-last rounded-full border border-gray-600 m-0 mx-auto py-3 px-8 text-lg cursor-pointer"
        >
          Quick and fast
        </Badge>

        <p
          className={cn(
            "col-span-6 col-start-1 row-start-2 text-4xl md:text-5xl lg:text-7xl xl:text-[6.25rem] leading-26",
            sfProRegular.className
          )}
        >
          AI-Solutionz
        </p>

        <Badge
          variant="outline"
          className="col-span-2 col-start-7 2xl:col-start-6 row-span-1 row-start-2 self-center rounded-full border border-gray-600 m-0 mx-auto py-3 px-6 text-lg cursor-pointer"
        >
          Smart Assistants
        </Badge>

        <p
          className={cn(
            "col-start-1 text-4xl md:text-5xl lg:text-7xl xl:text-[6.25rem] leading-26",
            sfProRegular.className
          )}
        >
          Assistants
        </p>

        <div className="col-span-4 col-start-1 py-10">
          <AvatarGroup
            avatars={[
              "https://randomuser.me/api/portraits/men/32.jpg",
              "https://randomuser.me/api/portraits/men/45.jpg",
              "https://randomuser.me/api/portraits/men/32.jpg",
              "https://randomuser.me/api/portraits/men/32.jpg",
            ]}
          />
          <p className="text-gray-500 text-xl pt-3.5">
            More Than 5,000 Happy Clients Worldwide
          </p>
        </div>

        <div className="col-span-4 col-start-1 pb-8 2xl:pb-20">
          <h2 className="text-4xl font-bold">Artificial Intelligence</h2>
          <p className="mt-3 text-xl max-w-md text-gray-600">
            Create proffessional-grade designs in seconds, Our AI turns your
            ideas extraordinary works of art
          </p>

          <div className="flex space-x-4 mt-8">
            {socialLinks.map((link, index) => (
              <Link
                key={`social-${index}`}
                href={link.url}
                className="flex items-center p-3 rounded-full border border-gray-400/40 shadow-sm"
              >
                <link.icon size={24} />
              </Link>
            ))}
          </div>
        </div>

        <div className="col-span-3 col-start-6 absolute bottom-0 mx-2 overflow-hidden">
          <div className="relative h-full flex-center">
            <div className="relative w-full h-full z-20">
              <Image
                className="bg-transparent w-full h-full object-cover"
                src="/images/Iphone-frame.png"
                alt="frame"
              />
            </div>

            <div className="absolute w-full h-full z-10">
              <div className="pointer-events-none w-[95%] aspect-[380/848] mx-auto object-cover rounded-t-[1.75rem] md:rounded-t-[2.25rem] lg:rounded-t-[3rem] xl:rounded-t-[3.70rem] 2xl:rounded-t-[4.5rem] overflow-hidden">
                <NextVideo
                  className="h-full w-full object-cover"
                  preload="none"
                  src={demoVideo}
                  playsInline
                  autoPlay
                  muted
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-4 col-start-9 absolute bottom-0 mx-3 xl:mx-6 overflow-hidden">
          <div className="relative w-full h-full flex-center">
            <div className="relative w-full h-full z-20">
              <Image
                className="bg-transparent w-full h-full object-cover"
                src="/images/Iphone-frame.png"
                alt="frame"
              />
            </div>

            <div className="absolute h-full w-full z-10">
              <div className="pointer-events-none w-[95%] aspect-[380/848] mx-auto object-cover rounded-t-[1.75rem] md:rounded-t-[2.25rem] lg:rounded-t-[3rem] xl:rounded-t-[3.70rem] 2xl:rounded-t-[4.5rem] overflow-hidden">
                <NextVideo
                  className="h-full w-full object-cover"
                  preload="none"
                  src={demoVideo}
                  playsInline
                  autoPlay
                  muted
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
