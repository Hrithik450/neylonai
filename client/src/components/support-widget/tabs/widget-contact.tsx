import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Mail,
  Phone,
  Calendar,
  Linkedin,
  Twitter,
  Github,
  Youtube,
  Instagram,
} from "lucide-react";

export function WigetContact({
  setMessage,
  setStatus,
}: {
  setMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setStatus: React.Dispatch<
    React.SetStateAction<"error" | "saving" | "saved" | null>
  >;
}) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  // Placeholder Google Meet booking handler
  const handleGoogleMeetBooking = () => {
    window.open(
      "https://calendar.google.com/calendar/u/0/r/eventedit",
      "_blank"
    );
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setMessage("Please fill all required fields.");
      setStatus("error");
      return;
    }

    try {
      setLoading(true);
      setStatus("saving");

      // Placeholder API call (connect to your backend)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setMessage("Your message has been sent successfully!");
      setStatus("saved");
      setForm({ name: "", company: "", email: "", message: "" });
    } catch (error) {
      setMessage("Something went wrong. Please try again.");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full px-4 sm:px-5 py-4 space-y-6 overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
          Contact & Partnerships
        </h2>
        <p className="text-sm md:text-md text-gray-600 mt-1">
          Let’s collaborate, partner, or discuss business opportunities.
        </p>
      </div>

      {/* Contact Cards */}
      <div className="grid grid-cols-1 gap-3">
        <div className="cursor-pointer p-3 px-5 border rounded-xl bg-white shadow-sm flex items-center gap-3 hover:shadow-md transition-all">
          <Mail className="w-6 h-6 text-green-600 mt-1" />
          <div>
            <h3 className="font-medium text-sm md:text-base">
              Sales & Partnerships
            </h3>
          </div>
        </div>

        <div className="cursor-pointer p-3 px-5 border rounded-xl bg-white shadow-sm flex items-center gap-3 hover:shadow-md transition-all">
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
          onClick={handleGoogleMeetBooking}
          className="cursor-pointer w-full mt-3 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2 text-base"
        >
          Book a Meeting via Google Meet
        </Button>
      </div>

      {/* Social Links */}
      <div>
        <div className="flex justify-center gap-6 pb-3">
          <a
            href="https://linkedin.com/company/aisolutionz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-purple-600"
          >
            <Linkedin className="w-6 h-6" />
          </a>
          <a
            href="https://x.com/aisolutionz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-purple-600"
          >
            <Instagram className="w-6 h-6" />
          </a>
          <a
            href="https://github.com/aisolutionz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-purple-600"
          >
            <Github className="w-6 h-6" />
          </a>
          <a
            href="https://github.com/aisolutionz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-purple-600"
          >
            <Youtube className="w-6 h-6" />
          </a>
          <a
            href="https://github.com/aisolutionz"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-600 hover:text-purple-600"
          >
            <Twitter className="w-6 h-6" />
          </a>
        </div>
        <p className="text-center">CEO, AI-Solutionz</p>
      </div>
    </div>
  );
}
