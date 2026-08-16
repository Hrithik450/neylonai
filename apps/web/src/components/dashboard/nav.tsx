"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Primary customer nav — Billing under Settings; Developer off the strip. */
const LINKS = [
  { href: "/dashboard", label: "Overview", id: "nav-link-overview" },
  { href: "/dashboard/widget", label: "Widget", id: "nav-link-widget" },
  { href: "/dashboard/conversations", label: "Conversations", id: "nav-link-conversations" },
  { href: "/dashboard/integrations", label: "Integrations", id: "nav-link-integrations" },
  { href: "/dashboard/agents", label: "Agents", id: "nav-link-agents" },
  { href: "/dashboard/usage", label: "Usage", id: "nav-link-usage" },
  { href: "/dashboard/settings", label: "Settings", id: "nav-link-settings" },
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
            id={link.id}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "nav-link flex-none rounded-full border border-[var(--ink)] px-4 py-1.5 text-sm whitespace-nowrap transition-colors",
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
