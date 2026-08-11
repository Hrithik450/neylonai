"use client";

import type { ReactNode } from "react";

export function SettingsSectionFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h2 className="text-2xl sm:text-3xl">{title}</h2>
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
