"use client";

import { cn } from "@/lib/utils";
import { useSupportWidgetToggleStore } from "@/store/store";
import { ArrowLeftIcon, X } from "lucide-react";
import React from "react";

/**
 * Props for the WidgetHeader component.
 * @interface WidgetHeaderProps
 * @property {string} [header] - Header text
 * @property {string | null} [className] - Classname for additional css [optional]
 */
interface WidgetHeaderProps {
  header: string;
  className?: string;
  action?: () => void;
}

/**
 * WidgetHeader component – displays a sticky header for support widget.
 *
 * @component
 * @returns {JSX.Element} The WidgetHeader component.
 */
export const WidgetHeader: React.FC<WidgetHeaderProps> = ({
  action,
  header,
  className,
}): React.JSX.Element => {
  const { isOpen, setIsOpen } = useSupportWidgetToggleStore();

  return (
    <nav
      className={cn(
        "pb-2 flex items-center border-b-2 border-black/10",
        "bg-[rgb(144,238,144)]",
        className
      )}
    >
      <div className="h-full my-auto mr-auto ml-4">
        {action && (
          <button
            className="text-xl font-bold cursor-pointer h-full"
            onClick={action}
          >
            <ArrowLeftIcon className="w-5 h-5 text-black" />
          </button>
        )}
      </div>

      <h3 className="text-center flex-1 text-lg">{header}</h3>

      <div className="h-full my-auto ml-auto mr-4">
        <button
          className="text-xl font-bold cursor-pointer h-full"
          onClick={() => setIsOpen(!isOpen)}
        >
          <X className="w-5 h-5 text-black" />
        </button>
      </div>
    </nav>
  );
};
