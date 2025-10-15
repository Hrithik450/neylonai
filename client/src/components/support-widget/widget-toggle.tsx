"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, MessagesSquare } from "lucide-react";
import { SupportWidget } from "@/components/support-widget/widget";
import { useSupportWidgetToggleStore, useUserStore } from "@/store/store";
import { SuccessAlert } from "@/components/success-alert";
import { FailureAlert } from "@/components/failure-alert";
import { Session } from "next-auth";

export function AIChat({ session }: { session: Session | null }) {
  const { setTokens } = useUserStore();
  const { isOpen, setIsOpen } = useSupportWidgetToggleStore();
  const [loading, setLoading] = React.useState<boolean>(false);

  const [message, setMessage] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<
    "error" | "saving" | "saved" | null
  >(null);

  React.useEffect(() => {
    const fetchUser = async (id: string) => {
      try {
        setLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/user/${id}`
        );
        const data = await response.json();

        if (!data.success) {
          setLoading(false);
          console.error("Error fetching user details:", data.error);
          return;
        }

        if (data.data) setTokens(data.data.daily_limit);
      } catch (error) {
        console.error("Fetch error:", error);
        setLoading(false);
      } finally {
        setLoading(false);
      }
    };

    if (session && session.user && session.user.id) fetchUser(session.user.id);
  }, [session]);

  return (
    <div className="fixed bottom-3 right-3 sm:right-6 2xl:right-[max(1rem,calc((100vw-120rem)/2+2rem))] z-99 flex flex-col items-end">
      <SupportWidget setMessage={setMessage} setStatus={setStatus} />

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-[#0E3228] border border-white/80 cursor-pointer w-15 h-15 rounded-full flex items-center justify-center transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        <div
          className={cn(
            isOpen ? "rotate-90" : "rotate-0",
            "transform transition-transform duration-200 "
          )}
        >
          {isOpen ? (
            <ChevronRight className="w-6 h-6 text-white" />
          ) : (
            <MessagesSquare className="w-6 h-6 text-white" />
          )}
        </div>
      </button>

      {status === "saved" && message && (
        <SuccessAlert
          message={message}
          duration={2000}
          setStatus={setStatus}
          setMessage={setMessage}
        />
      )}
      {status === "error" && message && (
        <FailureAlert
          message={message}
          duration={2000}
          setStatus={setStatus}
          setMessage={setMessage}
        />
      )}
    </div>
  );
}
