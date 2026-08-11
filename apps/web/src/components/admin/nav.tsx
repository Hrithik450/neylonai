"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/unit-economics", label: "Unit Economics" },
  { href: "/admin/organizations", label: "Organizations" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/subscriptions", label: "Subscriptions" },
  { href: "/admin/api-keys", label: "API keys" },
  { href: "/admin/agents", label: "Agents" },
  { href: "/admin/integrations", label: "Integrations" },
  { href: "/admin/knowledge", label: "Knowledge" },
  { href: "/admin/conversations", label: "Conversations" },
  { href: "/admin/system", label: "System" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-4 -mb-px flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
      {LINKS.map((link) => {
        const active =
          link.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex-none border-b px-3 py-2.5 text-sm font-medium whitespace-nowrap",
              active
                ? "border-foreground text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
