"use client";

import { cn } from "@/lib/utils";
import { useSupportWidgetToggleStore } from "@/store/store";
import { ArrowLeftIcon, X, Minimize2, Maximize2 } from "lucide-react";
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
      <div className="h-full flex-1 my-auto mr-auto ml-4">
        {action && (
          <button
            className="text-xl font-bold cursor-pointer h-full"
            onClick={action}
          >
            <ArrowLeftIcon className="w-5 h-5 text-black" />
          </button>
        )}
      </div>

      <h3 className="text-center flex-2 text-lg">{header}</h3>

      <div className="flex-1 flex justify-center items-center gap-4">
        <div className="flex items-center h-full my-auto ml-auto">
          <button
            className="text-xl font-bold cursor-pointer h-full"
            onClick={() => setCollapse(!isCollapse)}
          >
            {isCollapse ? (
              <Maximize2 className="w-5 h-5 text-black" />
            ) : (
              <Minimize2 className="w-5 h-5 text-black" />
            )}
          </button>
        </div>

        <div className="flex items-center h-full my-auto mr-4">
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
