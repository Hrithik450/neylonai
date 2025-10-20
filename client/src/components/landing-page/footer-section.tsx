import { guminertBold, guminertRegular } from "@/assets/fonts";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function Footer() {
  return (
    <footer
      className={cn(
        guminertRegular.className,
        "pt-10 md:pt-16 mt-10 px-6 md:px-10 xl:px-16 2xl:px-20 relative overflow-hidden bg-[#000B0E] text-white"
      )}
    >
      <div className="max-w-[120rem] mx-auto">
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
            <h3 className="text-lg font-semibold mb-4">Solutions</h3>
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
              <li>
                <Link href="#">Blog & Insights</Link>
              </li>
              <li>
                <Link href="#">Privacy Policy</Link>
              </li>
              <li>
                <Link href="#">Features</Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Us</h3>
            <p className="text-gray-300 text-sm md:text-base mb-2">
              mhrithik450@gmail.com{" "}
            </p>
            <p className="text-gray-300 text-sm md:text-base">
              Bengaluru, India
            </p>
          </div>
        </div>

        <div className="w-full text-center mt-6 py-6 text-gray-400 text-sm md:text-base border-t border-gray-700">
          <p>
            © {new Date().getFullYear()}{" "}
            <span className="text-white font-semibold">Neylon AI</span> —
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
