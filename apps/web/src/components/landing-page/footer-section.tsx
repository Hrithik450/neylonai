"use client";

import { guminertBold, guminertRegular } from "@/assets/fonts";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function Footer() {
  return (
    <footer
      id="footer"
      className={cn(
        guminertRegular.className,
        "pt-10 md:pt-16 mt-10 px-6 md:px-10 xl:px-16 2xl:px-20 relative overflow-hidden bg-[#000B0E] text-white",
      )}
    >
      <div className="max-w-480 mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10 border-b border-gray-700 pb-10">
          <div>
            <h2
              className={cn(
                "text-2xl md:text-4xl mb-4",
                guminertBold.className,
              )}
            >
              Neylon AI
            </h2>
            <p className="text-gray-400 text-sm md:text-base leading-relaxed">
              Affordable AI agents that help businesses capture leads, answer
              customer questions, and manage support requests.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2 text-gray-300 md:text-base">
              <li>FAQ&apos;s</li>
              <li>Features</li>
              <li>AI Assistant</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <button
              onClick={() =>
                window.open(
                  "https://mail.google.com/mail/u/0/?fs=1&to=mhrithik450@gmail.com&tf=cm",
                  "_blank",
                )
              }
              className="cursor-pointer text-gray-300 text-sm md:text-base mb-2"
            >
              mhrithik450@gmail.com{" "}
            </button>
            <p className="text-gray-300 text-sm md:text-base">
              Bengaluru, India
            </p>
          </div>
        </div>

        <div className="w-full text-center mt-6 py-6 text-gray-400 text-md md:text-base border-t border-gray-700">
          <p>
            © {new Date().getFullYear()} Neylon AI. All rights reserved.{" "}
            Engineered by{" "}
            <Link
              href="https://github.com/Hrithik450/"
              className="text-[#00b894] underline hover:text-[#00d6a7] transition-colors"
            >
              Hruthik M
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
