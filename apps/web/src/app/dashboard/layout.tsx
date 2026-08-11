import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireUser } from "@/server/auth-guards";
import { clearSessionCookie } from "@/server/auth-cookies";
import { DashboardNav } from "@/components/dashboard/nav";
import { redirect } from "next/navigation";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Shared dashboard shell width — application-oriented, not landing-page narrow.
 * ~90rem max with responsive side padding (tighter on large viewports).
 */
const SHELL = "mx-auto w-full max-w-[90rem]";

/** Horizontal padding: comfortable on small screens, tighter on large. */
const SHELL_X = "px-4 sm:px-6 lg:px-8 xl:px-6 2xl:px-5";

async function signOutAction() {
  "use server";
  await clearSessionCookie();
  redirect("/");
}

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();

  return (
    <div className="paper min-h-svh">
      <link
        rel="preload"
        href="/fonts/BandaNova-Book.woff2"
        as="font"
        type="font/woff2"
        crossOrigin="anonymous"
      />

      <header className={`nav-pill py-4 ${SHELL_X}`}>
        <div
          className={`${SHELL} flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4`}
        >
          <Link href="/dashboard" className="display text-2xl sm:text-3xl">
            Neylon AI
          </Link>

          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <div className="text-left sm:text-right">
              <span className="mono block text-[0.6rem] tracking-[0.16em] uppercase opacity-60">
                Signed in
              </span>
              <span className="text-sm font-medium leading-none">
                {user.name.split(" ")[0]}
              </span>
            </div>

            <div className="flex flex-none items-center gap-2 sm:gap-3">
              {user.role === "admin" ? (
                <Link
                  href="/admin"
                  className="btn-ink bg-white px-3.5 py-2 text-xs whitespace-nowrap sm:px-4"
                >
                  Admin
                </Link>
              ) : null}

              <form action={signOutAction}>
                <button
                  type="submit"
                  className="btn-ink bg-white px-3.5 py-2 text-xs whitespace-nowrap sm:px-4"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className={`${SHELL} mt-5 sm:mt-4`}>
          <DashboardNav />
        </div>
      </header>

      <main className={`${SHELL_X} py-8 sm:py-10 lg:py-12`}>
        <div className={SHELL}>{children}</div>
      </main>
    </div>
  );
}
