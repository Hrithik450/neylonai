"use client";

import { cn } from "@/lib/utils";
import { useSupportWidgetToggleStore } from "@/store/store";
import { X } from "lucide-react";
import React from "react";

const WidgetHeader = ({
  header,
  className,
}: {
  header: string;
  className?: string;
}) => {
  const { isOpen, setIsOpen } = useSupportWidgetToggleStore();

  return (
    <nav
      className={cn(
        "pb-2 flex items-base border-b-2 border-black/10",
        "bg-[rgb(144,238,144)]",
        className
      )}
    >
      <h3 className="text-center flex-grow text-lg">{header}</h3>

      <button
        className="my-auto ml-auto text-xl font-bold cursor-pointer pr-3 h-full"
        onClick={() => setIsOpen(!isOpen)}
      >
        <X className="w-5 h-5 text-black" />
      </button>
    </nav>
  );
};

export default WidgetHeader;
