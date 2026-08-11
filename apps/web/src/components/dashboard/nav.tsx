"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Primary customer nav — Billing under Settings; Developer off the strip. */
const LINKS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/conversations", label: "Conversations" },
  { href: "/dashboard/agents", label: "Agents" },
  { href: "/dashboard/widget", label: "Widget" },
  { href: "/dashboard/integrations", label: "Integrations" },
  { href: "/dashboard/usage", label: "Usage" },
  { href: "/dashboard/settings", label: "Settings" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {LINKS.map((link) => {
        const active =
          link.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-none rounded-full border border-[var(--ink)] px-4 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "text-white" : "bg-white hover:bg-[var(--cream)]",
            )}
            style={active ? { background: "var(--ink)" } : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
