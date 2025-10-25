"use client";

import { WidgetHeader } from "@/components/support-widget/widget-header";
import { ClassicLoader } from "@/components/classic-loader";
import { FiArrowRight } from "react-icons/fi";
import Image from "next/image";
import React from "react";
import { Session } from "next-auth";
import { useUserStore } from "@/store/store";
import { Edit } from "lucide-react";
import { signOutAccount } from "@/actions/auth/sign-out";

const AssistantDisplayMap: Record<string, string> = {
  internal_assistant: "Internal Assistant",
  customer_service_assistant: "Customer Service Assistant",
};

const RoleDisplayMap: Record<string, string> = {
  business_owner: "Business Owner",
  student: "Student",
  explorer: "Explorer",
  admin: "Admin",
};

export function WidgetSettings({
  popScreen,
  session,
}: {
  popScreen: () => void;
  session: Session | null;
}) {
  const { tokens, assistant, role } = useUserStore();

  if (!session?.user?.image)
    return (
      <div className="h-full w-full">
        <WidgetHeader header="Profile" action={() => popScreen()} />

        <div className="w-full h-full flex justify-center items-center">
          <ClassicLoader />
        </div>
      </div>
    );

  return (
    <div className="h-full w-full">
      {/* Header */}
      <WidgetHeader header="Profile" action={() => popScreen()} />

      <div className="p-4 w-full flex flex-col items-center space-y-3">
        <div className="w-full flex justify-between items-center pr-2">
          <div className="px-2 w-full flex justify-start items-center gap-3">
            <Image
              width={20}
              height={20}
              alt="Profile"
              src={session.user.image}
              className="w-17 h-17 rounded-full border mb-2"
            />

            <div className="space-y-0.5">
              <h3 className="text-xl font-semibold">{session.user.name}</h3>
              <p className="text-md text-black/80">{session.user.email}</p>
            </div>
          </div>

          <button
            type="button"
            className="p-2 hover:bg-gray-100 hover:cursor-pointer rounded-full transition"
            aria-label="Edit Profile"
          >
            <Edit className="w-5 h-5 text-gray-600 hover:text-gray-800 transition" />
          </button>
        </div>

        {/* Cards */}
        <div className="w-full space-y-3 mb-4">
          <div className="group hover:cursor-pointer bg-gray-100 rounded-2xl p-4 flex justify-between items-center shadow-sm hover:shadow-md transition">
            <div>
              <p className="text-md font-medium text-gray-800">
                Selected AI Assistant
              </p>
              <p className="text-sm text-gray-500">
                {assistant
                  ? AssistantDisplayMap[assistant]
                  : "Internal Assistant"}
              </p>
            </div>
            <FiArrowRight className="text-gray-400 group-hover:-rotate-45 transition-transform duration-150 ease-linear w-5 h-5" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-100 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition">
              <p className="font-medium text-gray-800 text-sm">Tokens Left</p>
              <p className="text-xl font-semibold text-blue-600">{tokens}</p>
            </div>
            <div className="bg-gray-100 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition">
              <p className="font-medium text-gray-800 text-sm">Role</p>
              <p className="text-xl text-gray-500 break-all">
                {role ? RoleDisplayMap[role] : "explorer"}
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => signOutAccount()}
          className="w-full text-sm md:text-base py-2 bg-red-500/80 hover:bg-red-500 hover:cursor-pointer text-white rounded-full font-medium shadow-md transition"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
