"use client";

import { useSupportWidgetToggleStore } from "@/store/store";
import { ArrowLeftIcon, X, Minimize2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import React from "react";

interface WidgetHeaderProps {
  header: string;
  className?: string;
  action?: () => void;
}

export const WidgetHeader: React.FC<WidgetHeaderProps> = ({
  action,
  header,
  className,
}): React.JSX.Element => {
  const { isOpen, setIsOpen, isCollapse, setCollapse } =
    useSupportWidgetToggleStore();

  return (
    <nav
      className={cn(
        "pb-2 flex items-center border-b-2 border-black/10",
        "bg-[rgb(144,238,144)]",
        className
      )}
    >
      <div className="w-full grid grid-cols-6 md:grid-cols-4 items-center px-4">
        <div className="flex items-center">
          {action && (
            <button
              className="text-xl font-bold cursor-pointer h-full"
              onClick={action}
            >
              <ArrowLeftIcon className="w-5 h-5 text-black" />
            </button>
          )}
        </div>

        <div className="flex justify-center col-span-4 md:col-span-2">
          <h3 className="text-center text-lg font-semibold">{header}</h3>
        </div>

        <div className="flex justify-end items-center gap-4">
          <button
            className="hidden md:block text-xl font-bold cursor-pointer h-full"
            onClick={() => setCollapse(!isCollapse)}
          >
            {isCollapse ? (
              <Maximize2 className="w-5 h-5 text-black" />
            ) : (
              <Minimize2 className="w-5 h-5 text-black" />
            )}
          </button>

          <button
            className="text-xl font-bold cursor-pointer h-full"
            onClick={() => setIsOpen(!isOpen)}
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>
      </div>
    </nav>
  );
};
