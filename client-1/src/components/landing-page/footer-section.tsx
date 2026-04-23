"use client";

import { guminertBold, guminertRegular } from "@/assets/fonts";
import { Link as ScrollLink } from "react-scroll";
import { cn } from "@/lib/utils";
import Link from "next/link";
import {
  TabType,
  useNavigationStore,
  useSupportWidgetToggleStore,
} from "@/store/store";

export function Footer() {
  const { setIsOpen } = useSupportWidgetToggleStore();
  const { switchTab } = useNavigationStore();

  return (
    <footer
      className={cn(
        guminertRegular.className,
        "pt-10 md:pt-16 mt-10 px-6 md:px-10 xl:px-16 2xl:px-20 relative overflow-hidden bg-[#000B0E] text-white"
      )}
    >
      <div className="max-w-480 mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 md:gap-10 border-b border-gray-700 pb-10">
          <div>
            <h2
              className={cn(
                "text-2xl md:text-4xl mb-4",
                guminertBold.className
              )}
            >
              Neylon AI
            </h2>
            <p className="text-gray-400 text-sm md:text-base leading-relaxed mb-6">
              Neylon AI is a full-service agency creating custom AI solutions,
              intelligent agents, and automation systems.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Custom Solutions</h3>
            <ul className="space-y-2 text-gray-300 md:text-base">
              <li>AI Chatbot Development</li>
              <li>Process Automation</li>
              <li>Data Intelligence</li>
              <li>Custom AI Models</li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Resources</h3>
            <ul className="space-y-2 text-gray-300 text-sm md:text-base">
              <button
                className="cursor-pointer"
                onClick={() => {
                  setIsOpen(true);
                  switchTab(TabType.Home);
                }}
              >
                Blog & Insights
              </button>
              <li>
                <Link href="#">Privacy Policy</Link>
              </li>
              <ScrollLink
                to="features"
                smooth={true}
                duration={300}
                offset={0}
                className="cursor-pointer flex items-center gap-2"
              >
                Features
              </ScrollLink>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <button
              onClick={() =>
                window.open(
                  "https://mail.google.com/mail/u/0/?fs=1&to=mhrithik450@gmail.com&tf=cm",
                  "_blank"
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
            © {new Date().getFullYear()}{" "}
            <span className="text-white font-semibold">Neylon AI</span> —
            Engineered by Team{" "}
            <Link
              href="https://www.linkedin.com/company/neylon-ai/"
              className="text-[#00b894] underline hover:text-[#00d6a7] transition-colors"
            >
              Neylon AI
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
