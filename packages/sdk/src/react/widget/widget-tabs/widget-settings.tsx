"use client";

import React from "react";
import { Edit } from "lucide-react";
import { WidgetHeader } from "../widget-header";
import { useWidgetHost } from "../../context/widget-host";

/** Optional settings tab (not registered by default). */
export function WidgetSettings() {
  const { user } = useWidgetHost();

  if (!user?.profile_image) {
    return (
      <div className="h-full w-full">
        <WidgetHeader header="Profile" />
        <div className="w-full h-full flex justify-center items-center text-sm text-gray-500">
          Sign in to view your profile.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <WidgetHeader header="Profile" />

      <div className="p-3 md:p-4 w-full flex flex-col items-center space-y-3">
        <div className="w-full flex justify-between items-center pr-2 pb-2">
          <div className="md:px-2 w-full flex justify-start items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="Profile"
              src={user.profile_image}
              className="w-14 h-14 md:w-17 md:h-17 rounded-full border object-cover"
            />

            <div className="space-y-0.5">
              <h3 className="text-lg md:text-xl font-semibold">{user.name}</h3>
              <p className="text-sm md:text-md text-black/80">{user.email}</p>
            </div>
          </div>

          <button
            type="button"
            className="p-2 hover:bg-gray-100 rounded-full transition"
            aria-label="Edit Profile"
          >
            <Edit className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}
