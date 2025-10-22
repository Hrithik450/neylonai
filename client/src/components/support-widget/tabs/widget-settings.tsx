"use client";

import {
  FiArrowRight,
  FiEdit,
  FiMail,
  FiLink,
  FiUser,
  FiSearch,
} from "react-icons/fi";
import React from "react";
import { Button } from "@/components/ui/button";
import { WidgetHeader } from "../widget-header";
import Image from "next/image";

interface UserProfile {
  name: string;
  email: string;
  profileImage: string;
}

export function WidgetSettings({ popScreen }: { popScreen: () => void }) {
  const user: UserProfile = {
    name: "Michael",
    email: "michaell50@gmail.com",
    profileImage:
      "https://lh3.googleusercontent.com/a/ACg8ocI29W3YA5pVL2AKKW1qL8RqZ5uwJcZFp4IhZONLRyrraeRpsA=s96-c",
  };

  return (
    <div className="h-full w-full">
      {/* Header */}
      <WidgetHeader header="Profile" action={() => popScreen()} />

      <div className="my-3 w-full flex flex-col items-center space-y-3">
        {/* <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-800">Profile</h2>
          <FiEdit className="text-gray-500 w-5 h-5 cursor-pointer" />
        </div> */}

        {/* Profile Section */}
        <div className="flex justify-center items-center">
          <Image
            width={20}
            height={20}
            alt="Profile"
            src={user.profileImage}
            className="w-20 h-20 rounded-full border mb-2"
          />

          <div>
            <h3 className="text-lg font-semibold">Hello-{user.name}</h3>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-3 mb-8">
          <div className="bg-gray-100 rounded-2xl p-4 flex justify-between items-center shadow-sm hover:shadow-md transition">
            <div>
              <p className="font-medium text-gray-800">
                Connect insurance with us!
              </p>
              <p className="text-xs text-gray-500">Step up unlimited</p>
            </div>
            <FiArrowRight className="text-gray-400 w-5 h-5" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-100 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition">
              <span className="inline-block bg-pink-100 text-pink-600 text-xs font-medium px-2 py-1 rounded-full mb-2">
                New
              </span>
              <p className="font-medium text-gray-800 text-sm">
                Special discounts
              </p>
              <p className="text-xs text-gray-500">just for you</p>
            </div>
            <div className="bg-gray-100 rounded-2xl p-4 text-center shadow-sm hover:shadow-md transition">
              <p className="font-medium text-gray-800 text-sm">
                My Recent Order
              </p>
              <p className="text-xs text-gray-500">
                Stay updated on your orders
              </p>
            </div>
          </div>
        </div>

        {/* Personal Information Section */}
        <div className="space-y-2">
          <h4 className="text-gray-700 font-semibold mb-2">
            Personal Information
          </h4>

          <div className="flex items-center justify-between bg-gray-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <FiUser className="text-gray-500" />
              <div>
                <p className="font-medium text-gray-800 text-sm">
                  Personal information
                </p>
                <p className="text-xs text-gray-500">
                  Manage your Account Details
                </p>
              </div>
            </div>
            <FiArrowRight className="text-gray-400 w-5 h-5" />
          </div>

          <div className="flex items-center justify-between bg-gray-100 p-4 rounded-2xl shadow-sm hover:shadow-md transition">
            <div className="flex items-center gap-3">
              <FiLink className="text-gray-500" />
              <div>
                <p className="font-medium text-gray-800 text-sm">
                  Linked accounts
                </p>
                <p className="text-xs text-gray-500">
                  Sync your accounts easily
                </p>
              </div>
            </div>
            <FiArrowRight className="text-gray-400 w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}
