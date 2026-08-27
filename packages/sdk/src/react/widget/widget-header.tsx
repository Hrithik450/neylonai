"use client";

import { ArrowLeftIcon, X, Minimize2, Maximize2 } from "lucide-react";
import { cn } from "../../ui";
import React from "react";
import { Button } from "../../ui";
import { useWidgetToggleStore } from "../store/widget-store";
import { useWidgetHost } from "../context/widget-host";

interface WidgetHeaderProps {
  header?: string;
  className?: string;
  action?: () => void;
  leading?: React.ReactNode;
}

/** Shared collapse + close controls used by every widget screen header. */
export function WidgetChromeActions() {
  const { isOpen, setIsOpen, isCollapse, setCollapse } = useWidgetToggleStore();
  const { config } = useWidgetHost();
  const iconColor = config.branding.primaryTextColor;

  return (
    <div className="flex justify-end items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="hidden md:inline-flex cursor-pointer"
        onClick={() => setCollapse(!isCollapse)}
        aria-label={isCollapse ? "Expand widget" : "Collapse widget"}
      >
        {isCollapse ? (
          <Maximize2 className="w-5 h-5" style={{ color: iconColor }} />
        ) : (
          <Minimize2 className="w-5 h-5" style={{ color: iconColor }} />
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Close widget"
        data-testid="widget-close"
      >
        <X className="w-5 h-5" style={{ color: iconColor }} />
      </Button>
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
      className={cn("pb-2 flex items-center border-b-2", className)}
      style={{
        background: config.branding.gradientFrom,
        borderColor: config.branding.borderColor,
      }}
    >
      <div className="w-full grid grid-cols-6 md:grid-cols-4 items-center px-4">
        <div className="flex items-center">
          {leading}
          {!leading && action && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="cursor-pointer"
              onClick={action}
              aria-label="Go back"
            >
              <ArrowLeftIcon
                className="w-5 h-5"
                style={{ color: config.branding.primaryTextColor }}
              />
            </Button>
          )}
        </div>

        <div className="flex justify-center min-w-0 col-span-4 md:col-span-2">
          {header ? (
            <h3
              title={header}
              className="max-w-full truncate text-center text-lg font-semibold"
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
