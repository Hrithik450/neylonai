import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/server/auth-guards";
import { clearSessionCookie } from "@/server/auth-cookies";
import { AdminNav } from "@/components/admin/nav";
import { Button } from "@neylonai/ui";
import { redirect } from "next/navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

async function signOutAction() {
  "use server";
  await clearSessionCookie();
  redirect("/");
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="admin-shell bg-muted/30 min-h-svh">
      <header className="bg-background border-b">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/admin"
              className="flex flex-none items-center gap-2 text-sm font-medium tracking-tight"
            >
              <span
                className="inline-flex size-5 items-center justify-center rounded bg-[#0E3228] text-[0.6rem] font-medium text-white"
                aria-hidden
              >
                N
              </span>
              Neylon AI Admin
            </Link>
            <span className="text-muted-foreground min-w-0 truncate text-xs">
              {admin.email}
            </span>
          </div>

          <div className="flex flex-none items-center gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none">
              <Link href="/dashboard">User view</Link>
            </Button>
            <form action={signOutAction} className="flex-1 sm:flex-none">
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="w-full sm:w-auto"
              >
                Sign out
              </Button>
            </form>
          </div>
        </div>

        <div className="mx-auto mt-2 max-w-7xl px-4 sm:mt-0 sm:px-6">
          <AdminNav />
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
