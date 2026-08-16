"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SettingsSectionFrame({
  title,
  description,
  id,
  headingId,
  children,
}: {
  title: string;
  description: string;
  id?: string;
  headingId?: string;
  children: ReactNode;
}) {
  return (
    <div id={id} className="space-y-6">
      <header className="space-y-1">
        <h2 id={headingId} className="text-2xl sm:text-3xl">{title}</h2>
        <p className="caption text-sm max-w-2xl">{description}</p>
      </header>
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mono block text-[0.65rem] font-bold tracking-[0.12em] uppercase opacity-60">
      {children}
    </span>
  );
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="caption text-xs mt-1">{children}</p>;
}

export function SettingsButton({
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn("btn-ink px-5 py-2.5 text-sm", className)}
      {...props}
    >
      {children}
    </button>
  );
}
