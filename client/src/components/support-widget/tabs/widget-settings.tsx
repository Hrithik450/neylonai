"use client";

import { WidgetHeader } from "@/components/support-widget/widget-header";
import { FiArrowRight } from "react-icons/fi";
import Image from "next/image";
import React from "react";

interface UserProfile {
  name: string;
  email: string;
  role: string;
  profileImage: string;
}

export function WidgetSettings({ popScreen }: { popScreen: () => void }) {
  const user: UserProfile = {
    name: "Michael",
    email: "michaell50@gmail.com",
    role: "Student",
    profileImage:
      "https://lh3.googleusercontent.com/a/ACg8ocI29W3YA5pVL2AKKW1qL8RqZ5uwJcZFp4IhZONLRyrraeRpsA=s96-c",
  };

  return (
    <div className="h-full w-full">
      {/* Header */}
      <WidgetHeader header="Profile" action={() => popScreen()} />

      <div className="p-4 w-full flex flex-col items-center space-y-3">
        <div className="px-2 w-full flex justify-start items-center gap-3">
          <Image
            width={20}
            height={20}
            alt="Profile"
            src={user.profileImage}
            className="w-17 h-17 rounded-full border mb-2"
          />

          <div className="space-y-0.5">
            <h3 className="text-xl font-semibold">{user.name}</h3>
            <p className="text-md text-black/80">{user.email}</p>
          </div>
        </div>

        {/* Cards */}
        <div className="w-full space-y-3 mb-4">
          <div className="bg-gray-100 rounded-2xl p-4 flex justify-between items-center shadow-sm hover:shadow-md transition">
            <div>
              <p className="text-md font-medium text-gray-800">
                Selected AI Assistant
              </p>
              <p className="text-sm text-gray-500">Customer Service</p>
            </div>
            <FiArrowRight className="text-gray-400 w-5 h-5" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-100 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition">
              <p className="font-medium text-gray-800 text-sm">Tokens Left</p>
              <p className="text-xl font-semibold text-blue-600">180</p>
            </div>
            <div className="bg-gray-100 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition">
              <p className="font-medium text-gray-800 text-sm">Role</p>
              <p className="text-xl text-gray-500 break-all">Student</p>
            </div>
          </div>
        </div>

        <button className="w-full text-sm md:text-base py-2 bg-red-500/80 hover:bg-red-500 hover:cursor-pointer text-white rounded-full font-medium shadow-md transition">
          Logout
        </button>
      </div>
    </div>
  );
}
