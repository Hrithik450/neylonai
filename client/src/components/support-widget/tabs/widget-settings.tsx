"use client";

import { WidgetHeader } from "@/components/support-widget/widget-header";
import { ClassicLoader } from "@/components/classic-loader";
import { FiArrowRight } from "react-icons/fi";
import Image from "next/image";
import React from "react";
import {
  AssistantDisplayMap,
  RoleDisplayMap,
  type Screen,
  TabType,
  useUserStore,
} from "@/store/store";
import { Edit } from "lucide-react";
import { signOutAccount } from "@/actions/auth/sign-out";
import { WidgetUpdateSettings } from "./widget-screens/widget-update-settings";
import { useSessionStore } from "@/store/session-store";

export function WidgetSettings({
  pushScreen,
}: {
  pushScreen: (tab: TabType, screen: Screen) => void;
}) {
  const { tokens, assistant, role } = useUserStore();
  const { user, isAuthenticated } = useSessionStore();

  if (!user?.profile_image)
    return (
      <div className="h-full w-full">
        <WidgetHeader header="Profile" />

        <div className="w-full h-full flex justify-center items-center">
          <ClassicLoader />
        </div>
      </div>
    );

  return (
    <div className="h-full w-full">
      {/* Header */}
      <WidgetHeader header="Profile" />

      <div className="p-3 md:p-4 w-full flex flex-col items-center space-y-3">
        <div className="w-full flex justify-between items-center pr-2 pb-2">
          <div className="md:px-2 w-full flex justify-start items-center gap-3">
            <Image
              width={20}
              height={20}
              alt="Profile"
              src={user.profile_image}
              className="w-14 h-14 md:w-17 md:h-17 rounded-full border"
            />

            <div className="space-y-0.5">
              <h3 className="text-lg md:text-xl font-semibold">{user.name}</h3>
              <p className="text-sm md:text-md text-black/80">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            className="p-2 hover:bg-gray-100 hover:cursor-pointer rounded-full transition"
            aria-label="Edit Profile"
          >
            <Edit
              onClick={() =>
                pushScreen(TabType.Settings, {
                  component: WidgetUpdateSettings,
                  props: { role: role, assistant: assistant },
                })
              }
              className="w-5 h-5 text-gray-600 hover:text-gray-800 transition"
            />
          </button>
        </div>

        {/* Cards */}
        <div className="w-full space-y-3 mb-4">
          <div
            className="group hover:cursor-pointer bg-gray-100 rounded-2xl p-4 flex justify-between items-center shadow-sm hover:shadow-md transition"
            onClick={() =>
              pushScreen(TabType.Settings, {
                component: WidgetUpdateSettings,
                props: { role: role, assistant: assistant },
              })
            }
          >
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
              <p className="text-sm md:text-lg text-gray-500 break-all">
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
