"use client";

import NeylonAI from "@/assets/images/neylon.jpg";
import { guminertBold, guminertRegular } from "@/assets/fonts";
import { scroller } from "react-scroll";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import {
  TabType,
  useErrorStore,
  useNavigationStore,
  useSupportWidgetToggleStore,
} from "@/store/store";
import { cn, NavItem, navLists } from "@/lib/utils";
import Image from "next/image";
import React, { useEffect, useRef } from "react";
import { AuthNavigations } from "./auth-navigation";
import { loginWithGoogleToken } from "@/lib/services/google-auth";
import { SessionResponse } from "@/lib/types/request-response";
import { useSessionStore } from "@/store/session-store";
import { useGoogleOAuth } from "@/providers/google-oauth-provider";
import { useGoogleRefButtons } from "@/providers/google-buttons-ref-provider";
import { useGoogleAuth } from "@/hooks/use-google-auth";

function PageNavigations({
  className,
  itemClassName,
}: {
  className: string;
  itemClassName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { setIsOpen } = useSupportWidgetToggleStore();
  const { switchTab } = useNavigationStore();

  const handleNavClick = (action: string) => {
    switch (action) {
      case "insights":
        setIsOpen(true);
        switchTab(TabType.Home);
        break;

      default:
        setIsOpen(true);
        switchTab(TabType.Contact);
        break;
    }
  };

  const handleNavRoute = async (section: string) => {
    if (pathname !== "/") {
      router.push(`/`);
    }

    scroller.scrollTo(section, {
      duration: 300,
      smooth: true,
      offset: 0,
    });
  };

  return (
    <div className={cn("flex flex-1 justify-center items-center", className)}>
      {navLists.map((navItem: NavItem) => (
        <div
          className={cn(
            "w-max text-black px-2 xl:px-3 transition-all cursor-pointer",
            itemClassName,
          )}
          key={navItem.id}
        >
          {navItem.action ? (
            <button
              className="cursor-pointer"
              onClick={() => {
                if (typeof navItem.action === "string")
                  handleNavClick(navItem.action);
              }}
            >
              {navItem.label}
            </button>
          ) : navItem.id === "ai" ? (
            <button
              onClick={() => {
                setIsOpen(true);
                switchTab(TabType.Home);
              }}
              className={cn(
                "text-xl lg:text-2xl cursor-pointer",
                guminertBold.className,
              )}
            >
              {navItem.label}
            </button>
          ) : (
            <button
              className="cursor-pointer"
              onClick={() => handleNavRoute(navItem.id)}
            >
              {navItem.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);

  const { clientId, scriptLoaded } = useGoogleOAuth();
  const { handleCredential, handleLogout } = useGoogleAuth();
  const { desktopButtonRef, mobileButtonRef } = useGoogleRefButtons();

  const { isAuthenticated, sessionChecked } = useSessionStore();

  useEffect(() => {
    if (!scriptLoaded || !window.google) return;
    if (isAuthenticated || !sessionChecked) return;

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
    });

    if (desktopButtonRef.current) {
      window.google.accounts.id.renderButton(desktopButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
      });
    }

    if (mobileButtonRef.current) {
      window.google.accounts.id.renderButton(mobileButtonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "signin_with",
      });
    }
  }, [scriptLoaded, isAuthenticated, sessionChecked]);

  return (
    <header
      id="header"
      className={cn(
        "max-w-480 mx-auto absolute z-98 w-full py-6 sm:py-8 px-4 md:px-8 lg:px-20 bg-transparent flex justify-between items-center",
        guminertRegular.className,
      )}
    >
      <nav
        className={cn(
          "container mx-auto flex justify-between items-center w-full backdrop-blur-xs border border-gray-400/60 rounded-full p-2 xl:p-3 transition-colors duration-300 ease-in-out",
          menuOpen
            ? "bg-[linear-gradient(to_bottom,rgb(210,245,130)_0%,white_100%)]"
            : "bg-white/25",
        )}
      >
        {/* Logo */}
        <div className="md:flex-1 flex items-center gap-3">
          <Image
            width={40}
            height={40}
            src={NeylonAI}
            alt="neylon-ai"
            className="rounded-full"
          />
          <h1 className={cn(guminertBold.className, "text-xl")}>Neylon AI</h1>
        </div>

        {/* Desktop Nav Links */}
        <div className="md:flex-1">
          <PageNavigations
            className="max-lg:hidden"
            itemClassName="text-base md:text-base xl:text-lg"
          />
        </div>

        {/* Desktop Buttons */}
        <div className="md:flex-1 flex justify-end">
          <AuthNavigations
            buttonRef={desktopButtonRef}
            handleLogout={handleLogout}
            className="ml-auto max-lg:hidden"
          />
        </div>

        {/* Mobile Menu Toggle */}
        <div className="lg:hidden flex items-center px-2">
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
              : "opacity-0 translate-y-4 pointer-events-none",
          )}
        >
          <PageNavigations
            className="flex-col text-lg text-center space-y-6"
            itemClassName="text-base md:text-lg"
          />

          <AuthNavigations
            buttonRef={mobileButtonRef}
            handleLogout={handleLogout}
            className="flex-col mt-4"
          />
        </div>
      </nav>
    </header>
  );
}
