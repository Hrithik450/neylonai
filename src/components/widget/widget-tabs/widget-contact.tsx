import React from "react";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  Calendar,
  Linkedin,
  Twitter,
  Youtube,
  Instagram,
} from "lucide-react";

export function WigetContact() {
  return (
    <div className="flex flex-col h-full px-4 sm:px-5 py-4 space-y-6 overflow-y-auto scrollbar-hide">
      <div className="text-center">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
          Contact & Partnerships
        </h2>
        <p className="text-sm md:text-md text-gray-600 mt-1">
          Let&apos;s collaborate, partner, or discuss business opportunities.
        </p>
      </div>

      {/* Contact Cards */}
      <div
        onClick={() =>
          window.open(
            "https://mail.google.com/mail/u/0/?fs=1&to=mhrithik450@gmail.com&tf=cm",
            "_blank",
          )
        }
        className="grid grid-cols-1 gap-3"
      >
        <div className="cursor-pointer p-3 px-5 border rounded-xl bg-white shadow-sm flex items-center gap-3 hover:shadow-md transition-all">
          <Mail className="w-6 h-6 text-green-600 mt-1" />
          <div>
            <h3 className="font-medium text-sm md:text-base">
              Sales & Partnerships
            </h3>
          </div>
        </div>

        <div
          onClick={() =>
            window.open(
              "https://mail.google.com/mail/u/0/?fs=1&to=mhrithik450@gmail.com&tf=cm",
              "_blank",
            )
          }
          className="cursor-pointer p-3 px-5 border rounded-xl bg-white shadow-sm flex items-center gap-3 hover:shadow-md transition-all"
        >
          <Phone className="w-6 h-6 text-green-600 mt-1" />
          <div>
            <h3 className="font-medium text-sm md:text-base">
              Technical Support
            </h3>
          </div>
        </div>
      </div>

      {/* Book Meeting Section */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Calendar className="w-8 h-8 text-green-700 -mt-0.5" />

          <div>
            <h3 className="text-sm md:text-base font-semibold text-gray-800">
              Schedule a Meeting
            </h3>
            <p className="text-xs md:text-base text-gray-600 mt-1">
              Book a Google Meet to discuss collaborations or support.
            </p>
          </div>
        </div>
        <Button
          onClick={() =>
            window.open("https://cal.com/hruthik-m-n9i1qx/45min", "_blank")
          }
          className="cursor-pointer w-full mt-3 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2 text-sm md:text-base"
        >
          Book a Meeting via Google Meet
        </Button>
      </div>

      {/* Social Links */}
      <div>
        <div className="flex justify-center gap-6 pb-3">
          <a
            href="https://www.linkedin.com/company/neylon-ai/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-purple-600"
          >
            <Linkedin className="w-6 h-6" />
          </a>
          {/* <a
            href="https://x.com/aisolutionz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-purple-600"
          >
            <Instagram className="w-6 h-6" />
          </a> */}
          <a
            href="https://youtube.com/@mhrithik450?si=ZdW7Syb486y91znI"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-purple-600"
          >
            <Youtube className="w-6 h-6" />
          </a>
          {/* <a
            href="https://github.com/aisolutionz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-purple-600"
          >
            <Twitter className="w-6 h-6" />
          </a> */}
          <a
            href="https://mail.google.com/mail/u/0/?fs=1&to=mhrithik450@gmail.com&tf=cm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-purple-600"
          >
            <Mail className="w-6 h-6" />
          </a>
        </div>
        <p className="text-center">Team, Neylon AI</p>
      </div>
    </div>
  );
}
