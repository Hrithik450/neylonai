import { ArrowRightIcon, ArrowUpFromDot, ShieldCheck } from "lucide-react";
import { guminertMedium, guminertRegular, sfProRegular } from "@/assets/fonts";
import FeatureGrid from "/public/images/feature_grid.jpg";
import { AvatarGroup } from "../avatar-group";
import { cn } from "@/lib/utils";
import Image from "next/image";

export function FeatureSection() {
  return (
    <section
      className={cn(
        sfProRegular.className,
        "pt-4 md:pt-8 mt-4 md:mt-8 px-3 md:px-5 xl:px-10 2xl:px-15 relative"
      )}
    >
      <header className="relative flex flex-col gap-4 md:gap-0 md:flex-row justify-between items-start md:items-end">
        <h2
          className={cn(
            guminertMedium.className,
            "max-w-xl text-4xl lg:text-5xl xl:text-6xl 2xl:text-7xl leading-tight md:leading-15 xl:leading-17 2xl:leading-19"
          )}
        >
          Our Features
        </h2>

        <button
          className={cn(
            "group flex items-center gap-3 bg-[#0d3129] p-3 px-6 rounded-full text-white cursor-pointer text-sm md:text-lg",
            guminertRegular.className
          )}
        >
          Book Appointment
          <ArrowRightIcon className="w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
        </button>
      </header>

      <main className="relative grid grid-cols-1 md:grid-cols-4 items-stretch justify-center my-6 lg:my-10 gap-4 sm:gap-6">
        <div className="max-sm:flex sm:hidden lg:flex flex-col row-span-2 col-span-1 bg-[#f2f2f2] rounded-xl px-4 py-6 shadow-md hover:rotate-2 transition-all duration-150 ease-in-out">
          <h3 className="text-2xl xl:text-3xl 2xl:text-4xl max-w-xs leading-tight font-semibold">
            Empowering Your Wealth with Precision
          </h3>

          <div className="py-6 sm:py-12">
            <AvatarGroup
              avatars={[
                "https://randomuser.me/api/portraits/men/32.jpg",
                "https://randomuser.me/api/portraits/men/45.jpg",
                "https://randomuser.me/api/portraits/men/32.jpg",
                "https://randomuser.me/api/portraits/men/32.jpg",
              ]}
            />
            <p className="max-w-[150px] text-black text-2xl pt-3.5 font-semibold">
              Daily New Clients
            </p>
          </div>

          <h1 className="text-5xl xl:text-6xl 2xl:text-7xl font-semibold">
            100
          </h1>
          <span className="text-xl 2xl:text-2xl py-2 text-gray-600">+36%</span>
        </div>

        <div className="row-span-1 col-span-1 sm:col-span-3 lg:col-span-2 relative flex flex-col h-full rounded-xl overflow-hidden shadow-md px-4 py-6 hover:rotate-2 transition-all duration-150 ease-in-out">
          <div className="absolute inset-0">
            <Image
              src={FeatureGrid}
              alt="feature-grid"
              className="w-full h-full"
            />
          </div>

          <h3 className="relative text-2xl xl:text-3xl 2xl:text-4xl max-w-xs leading-tight">
            Sales Analysis
          </h3>

          <div className="relative z-1 mt-6">
            <h1 className="text-5xl xl:text-6xl 2xl:text-7xl font-semibold">
              $35,600
            </h1>
            <span className="text-xl 2xl:text-2xl pt-3 text-gray-600">
              March 2026
            </span>
          </div>

          <div className="absolute bottom-0 left-10 z-0 w-full flex items-end justify-between px-8 gap-6">
            <div className="h-10 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(41,82,52)_0%,white_100%)]" />
            <div className="h-15 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(41,82,52)_0%,white_100%)]" />
            <div className="h-40 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(41,82,52)_0%,white_100%)]" />
            <div className="h-30 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(41,82,52)_0%,white_100%)]" />
            <div className="h-50 flex-1 rounded-t-2xl bg-[linear-gradient(to_bottom,rgb(41,82,52)_0%,white_100%)]" />
          </div>
        </div>

        <div className="col-span-1 relative bg-[#0d3129] flex flex-col h-full gap-4 sm:gap-6 p-2 rounded-xl overflow-hidden shadow-md px-4 2xl:px-6 py-6 hover:rotate-2 transition-all duration-150 ease-in-out">
          <h1 className="text-4xl xl:text-5xl 2xl:text-6xl font-semibold text-white">
            100K
          </h1>
          <span className="text-sm lg:text-lg max-w-[200px] text-gray-300/90">
            Users around the worldwide
          </span>

          <h3 className="mt-auto text-2xl 2xl:text-3xl text-white max-w-xs leading-tight">
            Sales Analysis
          </h3>
        </div>

        <div className="col-span-1 sm:col-start-1 lg:col-start-2 flex flex-col h-full bg-[#0d3129] text-white rounded-xl overflow-hidden shadow-md px-4 py-6 hover:rotate-2 transition-all duration-150 ease-in-out">
          <div className="flex items-center gap-4 mb-5 lg:mb-0">
            <div className="flex flex-col justify-center items-start gap-1 bg-white h-10 w-20 lg:w-30 rounded-xl text-black">
              <div className="w-10 lg:w-15 h-2 ml-2 rounded-xl bg-gray-300" />
              <div className="w-13 lg:w-20 h-2 ml-2 rounded-xl bg-gray-300" />
            </div>

            <div className="flex flex-col justify-center items-start gap-1 bg-white h-10 w-15 rounded-xl text-black overflow-hidden p-1 px-2">
              <Image
                src="https://randomuser.me/api/portraits/men/32.jpg"
                alt="avatar"
                className="w-full h-full object-cover rounded-full"
                width={48}
                height={48}
              />
            </div>
          </div>

          <p className="mt-auto text-xl lg:text-2xl max-w-[250px]">
            Your Personal Finance Toolkit
          </p>
          <span className="text-sm 2xl:text-md text-gray-300 max-w-[270px] mt-2 lg:mt-1">
            We provides tools to simplify your financial decisions
          </span>
        </div>

        <div className="relative bg-[#f2f2f2] col-span-1 sm:col-span-3 lg:col-span-2 sm:col-start-2 lg:col-start-3 flex flex-col md:flex-row items-start md:items-center gap-6 p-3 rounded-xl overflow-hidden shadow-md px-4 py-6 hover:rotate-2 transition-all duration-150 ease-in-out">
          <div className="px-6 py-4 sm:py-0 2xl:px-10 bg-white rounded-xl flex flex-col h-full gap-2 justify-center items-start md:items-center group">
            <ShieldCheck className="w-15 h-15 group-hover:scale-110 group-hover:rotate-5 transition-all duration-150 ease-in-out" />
            <h1 className="text-4xl font-semibold">$100M</h1>
            <p className="text-md">Fraud & Scan Protection</p>
          </div>

          <div className="flex-1 flex flex-col h-full justify-around items-start space-y-2">
            <h3 className="text-3xl max-w-[270px] font-semibold">
              Building a 100% Secure Financial Plan
            </h3>

            <p className="text-sm 2xl:text-lg text-gray-500">
              A step-by-step guide to creating a bulletproof financial roadmap
              for your future
            </p>

            <button className="text-md 2xl:text-lg cursor-pointer flex items-center gap-1 group">
              Read More
              <ArrowRightIcon className="w-4 h-4 2xl:w-5 2xl:h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
            </button>
          </div>
        </div>

        <div className="relative bg-[#f2f2f2] col-span-1 md:col-span-4 grid grid-cols-2 sm:grid-cols-4 items-center gap-6 p-3 rounded-xl overflow-hidden px-4 py-6">
          <div className="col-span-1 space-y-2 mx-auto">
            <div className="flex items-center group gap-1">
              <ArrowUpFromDot className="h-10 w-10 2xl:w-15 2xl:h-15 group-hover:rotate-45 transition-all duration-150 ease-in-out" />
              <h1 className="text-5xl xl:text-6xl 2xl:text-7xl">50%</h1>
            </div>

            <p className="text-gray-500 text-sm lg:text-lg 2xl:text-xl text-center">
              Client Acquisition
            </p>
          </div>

          <div className="col-span-1 space-y-2 mx-auto">
            <div className="flex items-center group gap-1">
              <ArrowUpFromDot className="h-10 w-10 2xl:w-15 2xl:h-15 group-hover:rotate-45 transition-all duration-150 ease-in-out" />
              <h1 className="text-5xl xl:text-6xl 2xl:text-7xl">65%</h1>
            </div>

            <p className="text-gray-500 text-sm lg:text-lg 2xl:text-xl text-center">
              Sales Revenue
            </p>
          </div>

          <div className="col-span-1 space-y-2 mx-auto">
            <div className="flex items-center group gap-1">
              <ArrowUpFromDot className="h-10 w-10 2xl:w-15 2xl:h-15 group-hover:rotate-45 transition-all duration-150 ease-in-out" />
              <h1 className="text-5xl xl:text-6xl 2xl:text-7xl">45%</h1>
            </div>

            <p className="text-gray-500 text-sm lg:text-lg 2xl:text-xl text-center">
              Improved Security
            </p>
          </div>

          <div className="col-span-1 space-y-2 mx-auto">
            <div className="flex items-center group gap-1">
              <ArrowUpFromDot className="h-10 w-10 2xl:w-15 2xl:h-15 group-hover:rotate-45 transition-all duration-150 ease-in-out" />
              <h1 className="text-5xl xl:text-6xl 2xl:text-7xl">70%</h1>
            </div>

            <p className="text-gray-500 text-sm lg:text-lg 2xl:text-xl text-center">
              Toolkit Engagement
            </p>
          </div>
        </div>
      </main>
    </section>
  );
}
