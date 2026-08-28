"use client";

import React from "react";
import { cn } from "../../ui";
import { useWidgetHost } from "../context/widget-host";
import { useWidgetToggleStore } from "../store/widget-store";
import { ArrowLeftIcon, X, Minimize2, Maximize2 } from "lucide-react";

interface WidgetHeaderProps {
  header?: string;
  className?: string;
  action?: () => void;
  leading?: React.ReactNode;
}


export function WidgetChromeActions() {
  const { config } = useWidgetHost();
  const { isOpen, setIsOpen, isCollapse, setCollapse } = useWidgetToggleStore();
  const iconColor = config.branding.primaryTextColor;

  return (
    <div className="flex justify-end items-center gap-4">
      <button
        type="button"
        className="hidden md:inline-flex cursor-pointer p-1 hover:opacity-70 transition-opacity !bg-transparent !border-none !shadow-none" 
        style={{ background: "transparent", border: "none", boxShadow: "none" }}
        onClick={() => setCollapse(!isCollapse)}
        aria-label={isCollapse ? "Expand widget" : "Collapse widget"}
      >
        {isCollapse ? (
          <Maximize2 className="w-5 h-5" style={{ color: iconColor }} />
        ) : (
          <Minimize2 className="w-5 h-5" style={{ color: iconColor }} />
        )}
      </button>

      <button
        type="button"
        className="cursor-pointer p-1 hover:opacity-70 transition-opacity !bg-transparent !border-none !shadow-none" 
        style={{ background: "transparent", border: "none", boxShadow: "none" }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Close widget"
        data-testid="widget-close"
      >
        <X className="w-5 h-5" style={{ color: iconColor }} />
      </button>
    </div>
  );
}

export const WidgetHeader: React.FC<WidgetHeaderProps> = ({
  action,
  header,
  className,
  leading,
}): React.JSX.Element => {
  const { config } = useWidgetHost();
  return (
    <nav
      className={cn(
        "py-2 flex items-center border-b-2",
        className,
      )}
      style={{
        background: config.branding.gradientFrom,
        borderColor: config.branding.borderColor,
        color: config.branding.primaryTextColor,
      }}
    >
      <div className="w-full grid grid-cols-6 md:grid-cols-4 items-center px-4">
        <div className="flex items-center">
          {leading}
          {!leading && action && (
            <button
              type="button"
              className="cursor-pointer p-1 hover:opacity-70 transition-opacity !bg-transparent !border-none !shadow-none" 
              style={{ background: "transparent", border: "none", boxShadow: "none" }}
              onClick={action}
              aria-label="Go back"
            >
              <ArrowLeftIcon
                className="w-5 h-5"
                style={{ color: config.branding.primaryTextColor }}
              />
            </button>
          )}
        </div>

        <div className="flex justify-center min-w-0 col-span-4 md:col-span-2">
          {header ? (
            <h3
              title={header}
              className="m-0 p-0 max-w-full truncate text-center text-sm font-semibold leading-none"
            >
              {header}
            </h3>
          ) : null}
        </div>

        <WidgetChromeActions />
      </div>
    </nav>
  );
};
