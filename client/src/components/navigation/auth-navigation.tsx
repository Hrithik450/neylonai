"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/store/session-store";
import Image from "next/image";
import { LogOut } from "lucide-react";
import { LoadingDots } from "../dot-loader";

export function AuthNavigations({
  className,
  buttonRef,
  handleLogout,
}: {
  className: string;
  handleLogout: () => void;
  buttonRef: React.Ref<HTMLDivElement | null>;
}) {
  const { user, isLoading, isAuthenticated } = useSessionStore();

  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-linear-to-r from-gray-600 to-gray-500 shadow-sm">
          <div className="flex items-center justify-center w-6 h-6">
            <LoadingDots />
          </div>

          <span className="text-sm font-medium text-white tracking-wide">
            Signing you in
          </span>
        </div>
      </div>
    );
  }

  if (user && isAuthenticated) {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <div className="flex items-center gap-2">
          {user.profile_image && (
            <Image
              src={user.profile_image}
              alt={user.name ?? "User"}
              width={36}
              height={36}
              className="rounded-full"
            />
          )}
          <span className="text-lg font-medium text-gray-700">{user.name}</span>
        </div>
        <div className="relative group">
          <button
            onClick={handleLogout}
            className="cursor-pointer px-6 lg:px-2 py-2 rounded-full border border-red-600 text-red-600 hover:bg-red-50 flex justify-center items-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            <p className="lg:hidden">Logout</p>
          </button>

          <div className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm rounded-md px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none">
            Logout
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center", className)}>
      <div ref={buttonRef} />
    </div>
  );
}
