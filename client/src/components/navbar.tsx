"use client";

import AISolutionz from "@/assets/images/ai-solutionz.png";
import { signInWithGoogle } from "@/actions/auth/sign-in";
import { signOutAccount } from "@/actions/auth/sign-out";
import { guminertRegular } from "@/assets/fonts";
import { Button } from "@/components/ui/button";
import { cn, navLists } from "@/lib/utils";
import { LogIn, LogOut, Menu, X } from "lucide-react";
import { Session } from "next-auth";
import Image from "next/image";
import React from "react";
import { useUserStore } from "@/store/store";

function PageNavigations({
  className,
  itemClassName,
}: {
  className: string;
  itemClassName: string;
}) {
  return (
    <div className={cn("flex flex-1 justify-center", className)}>
      {navLists.map((navItem) => (
        <div
          className={cn(
            "px-2 xl:px-3 text-black transition-all cursor-pointer",
            itemClassName
          )}
          key={navItem.id}
        >
          {navItem.label}
        </div>
      ))}
    </div>
  );
}

function AuthNavigations({
  className,
  session,
}: {
  className: string;
  session: Session | null;
}) {
  return !session ? (
    <div className={cn("flex items-center gap-4 xl:gap-6", className)}>
      <Button
        variant="default"
        className="rounded-full px-6 xl:px-10 py-6 text-base cursor-pointer"
        onClick={async () => {
          await signInWithGoogle();
        }}
      >
        Login
      </Button>
    </div>
  ) : (
    <div className={cn("flex items-center gap-4", className)}>
      <div className="flex items-center gap-2">
        {session.user?.image && (
          <Image
            src={session.user.image}
            alt={session.user.name ?? "User"}
            width={36}
            height={36}
            className="rounded-full"
          />
        )}
        <span className="font-medium text-gray-700">{session.user?.name}</span>
      </div>
      <div className="relative group">
        <button
          onClick={() => signOutAccount()}
          className="cursor-pointer px-6 sm:px-2 py-2 rounded-full border border-red-600 text-red-600 hover:bg-red-50 flex justify-center items-center gap-2"
        >
          <LogOut className="w-5 h-5" />
          <p className="sm:hidden">Logout</p>
        </button>

        <div className="hidden sm:block absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-sm rounded-md px-3 py-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out pointer-events-none">
          Logout
        </div>
      </div>
    </div>
  );
}

export function Navbar({ session }: { session: Session | null }) {
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);
  const { setCurrentUserId } = useUserStore();

  React.useEffect(() => {
    if (session && session.user && session.user.id)
      setCurrentUserId(session.user?.id);
  }, [session]);

  return (
    <header
      id="header"
      className={cn(
        "max-w-[120rem] mx-auto absolute z-98 w-full py-6 sm:py-8 px-4 md:px-8 lg:px-20 bg-transparent flex justify-between items-center",
        guminertRegular.className
      )}
    >
      <nav
        className={cn(
          "container mx-auto flex justify-between items-center w-full backdrop-blur-xs border border-gray-400/60 rounded-full py-3 md:p-2 xl:p-3 transition-colors duration-300 ease-in-out",
          menuOpen
            ? "bg-[linear-gradient(to_bottom,rgb(210,245,130)_0%,white_100%)]"
            : "bg-white/25"
        )}
      >
        {/* Logo */}
        <div className="px-4 flex items-center w-full max-w-[220px] sm:max-w-[180px] xl:max-w-[240px]">
          <Image
            src={AISolutionz}
            alt="ai-solutionz"
            className="w-full h-auto"
          />
        </div>

        {/* Desktop Nav Links */}
        <PageNavigations
          className="max-lg:hidden"
          itemClassName="text-base md:text-base xl:text-lg"
        />

        {/* Desktop Buttons */}
        <div className="flex justify-end max-w-[180px] xl:max-w-[240px] w-full">
          <AuthNavigations
            className="ml-auto max-lg:hidden"
            session={session}
          />
        </div>

        {/* Mobile Menu Toggle */}
        <div className="lg:hidden flex items-center px-4">
          {menuOpen ? (
            <X
              className="cursor-pointer text-black"
              onClick={() => setMenuOpen(false)}
            />
          ) : (
            <Menu
              className="cursor-pointer text-black"
              onClick={() => setMenuOpen(true)}
            />
          )}
        </div>

        {/* Mobile Menu Drawer */}
        <div
          className={cn(
            "lg:hidden mx-auto absolute top-[110%] left-0 z-5 w-full bg-[linear-gradient(to_bottom,rgb(210,245,130)_0%,white_100%)] border border-gray-400/60 rounded-2xl py-6 px-6 flex flex-col items-center gap-2 shadow-md transition-all duration-300 ease-in-out transform",
            menuOpen
              ? "opacity-100 translate-y-0 pointer-events-auto"
              : "opacity-0 translate-y-4 pointer-events-none"
          )}
        >
          <PageNavigations
            className="flex-col text-lg text-center space-y-6"
            itemClassName="text-base md:text-lg"
          />

          <AuthNavigations className="flex-col mt-4" session={session} />
        </div>
      </nav>
    </header>
  );
}
