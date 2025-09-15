import { NavItems, policies } from "@/lib/constants";
import { guminertBold, guminertRegular } from "@/assets/fonts";
import { Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function Footer() {
  return (
    <footer
      className={cn(
        guminertRegular.className,
        "pt-4 md:pt-8 mt-4 md:mt-16 px-3 md:px-5 xl:px-10 2xl:px-15 relative overflow-hidden bg-[#000B0E]"
      )}
    >
      <div className="max-w-[120rem] mx-auto">
        <div className="mt-8 px-4 md:px-8">
          <div className="w-full">
            <div
              className={cn(
                "text-white text-xl md:text-4xl mb-5",
                guminertBold.className
              )}
            >
              AI Solutionz
            </div>

            <p className="text-white text-xs md:text-md lg:text-lg leading-relaxed">
              Shape your project's vision with expert guidance. MACH Consultants
              helps reveal hidden resources and grow your enterprise's
              potential. Leave your contact info, and we'll connect within 24
              hours.
            </p>
          </div>

          {/* Bottom Section */}
          <div className="w-full border-t text-center text-black border-gray-300/80 mt-12 py-6 flex flex-col md:flex-row justify-between items-center gap-4 hover:opacity-90">
            <p className="text-white w-full text-sm md:text-lg text-center">
              Copyright © {new Date().getFullYear()} AI-Solutionz | Engineered
              by{" "}
              <Link
                className={cn(
                  "underline text-blue-500",
                  guminertBold.className
                )}
                href={"https://github.com/Hrithik450/"}
              >
                Hruthik M
              </Link>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
