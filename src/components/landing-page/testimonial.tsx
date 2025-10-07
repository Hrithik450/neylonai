import TestimonialGrid from "@/assets/images/testimonial_grid.jpg";
import { ArrowRightIcon, BadgeCheck, Star } from "lucide-react";
import { guminertMedium, guminertRegular } from "@/assets/fonts";
import { cn } from "@/lib/utils";
import Image from "next/image";

export function TestimonialCard() {
  return (
    <div
      className={cn(
        "bg-white shadow-md rounded-xl p-6 max-w-lg mx-auto",
        guminertRegular.className
      )}
    >
      <div className="flex mb-4 space-x-2">
        {[...Array(5)].map((_, index) => (
          <Star
            key={index}
            className="w-6 h-6 text-yellow-400 fill-yellow-400"
          />
        ))}
      </div>

      <p className="text-gray-700 text-sm sm:text-lg 2xl:text-xl mb-6">
        &quot;Personalized service, highly professional and trustworthy team,
        makes banking a pleasure. Professional and trustworthy team, makes
        banking a pleasure.&quot;
      </p>

      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full overflow-hidden">
          <Image
            src="https://randomuser.me/api/portraits/men/32.jpg"
            alt="David Thompson"
            width={48}
            height={48}
          />
        </div>

        <div>
          <h4 className="font-semibold text-gray-900">David Thompson</h4>
          <p className="text-gray-500 text-sm">Software Engineer</p>
        </div>
      </div>
    </div>
  );
}

export function Testimonials() {
  return (
    <section
      className={cn(
        guminertRegular.className,
        "pt-4 md:pt-8 mt-4 md:mt-8 px-3 md:px-5 xl:px-10 2xl:px-15 relative h-[750px] rounded-4xl overflow-hidden"
      )}
    >
      <div className="relative flex h-full w-full flex-col sm:flex-row items-center justify-center shadow-md lg:gap-10 pl-6 xl:pl-10">
        <div className="absolute inset-0">
          <Image
            src={TestimonialGrid}
            alt="testimonial-grid"
            className="w-full h-full rounded-4xl"
          />
        </div>

        <div className="sm:flex-1 h-fit w-full max-sm:py-10">
          <div className="relative flex justify-start items-center">
            <div className="flex justify-center items-center gap-1 rounded-full p-0.5 px-2 border border-gray-400/90 shadow-xs bg-white/80">
              <BadgeCheck className="text-gray-600/80 fill-[#C0EB5D] rounded-full p-0.5 w-6 h-6" />
              <span className="text-sm md:text-base text-black">
                Client Testimonials
              </span>
            </div>
          </div>

          <h1
            className={cn(
              "mt-3 text-4xl sm:text-5xl xl:text-6xl 2xl:text-7xl relative w-full text-left max-w-md xl:max-w-xl",
              guminertMedium.className
            )}
          >
            What Our Client Say&apos;s About Us
          </h1>

          <p className="relative text-left text-gray-600 text-md sm:text-xl my-4 sm:my-6">
            Our bank service is designed to empower your financial dreams with
            innovative solutions and unwavering commitment
          </p>

          <button className="relative group flex items-center gap-3 bg-[#0d3129] p-3 px-6 rounded-full text-white cursor-pointer text-sm md:text-lg">
            Explore Services
            <ArrowRightIcon className="w-5 h-5 group-hover:-rotate-45 transition-all duration-150 ease-in-out" />
          </button>
        </div>

        <div className="flex-1 relative h-full w-full overflow-hidden">
          <div className="absolute top-0 left-0 w-[92%] lg:w-[95%] xl:w-full animate-y-scroll space-y-4">
            {[...Array(6)].map((_, idx) => (
              <TestimonialCard key={idx} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
