"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, LogOut, LayoutDashboard, LogIn } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSessionView } from "@/components/session-view";
import { useGoogleAuthHandler } from "@/hooks/use-google-auth-handler";
import { GoogleSignInButton } from "@/components/google-signin-button";
import { LoadingDots } from "../dot-loader";

// design.md tokens
const BG = "#FFF7F4";
const TEXT = "#242424";

const NAV_LINKS = [
  { label: "Solutions", id: "showcase" },
  { label: "Features", id: "features" },
  { label: "How it works", id: "how-it-works" },
  { label: "Pricing", id: "comparison" },
  { label: "Blog", id: "footer" },
];

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

function NavAuthButtons() {
  const { handleLogout } = useGoogleAuthHandler();
  const { user, isLoading, isAuthenticated } = useSessionView();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5">
        <LoadingDots />
        <span style={{ fontSize: 13, color: TEXT }}>Signing in…</span>
      </div>
    );
  }

  if (user && isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        <a
          href="/dashboard"
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: TEXT,
            textDecoration: "none",
          }}
        >
          Dashboard
        </a>
        {user.profile_image && (
          <Image
            src={user.profile_image}
            alt={user.name ?? "User"}
            width={28}
            height={28}
            className="rounded-full"
          />
        )}
        <button
          onClick={handleLogout}
          title="Log out"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 13,
            fontWeight: 600,
            color: TEXT,
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* Log in — plain text */}
      <GoogleSignInButton
        style={{
          height: 40,
          alignItems: "center",
          fontSize: 13,
          fontWeight: 600,
          color: TEXT,
        }}
      >
        Log in
      </GoogleSignInButton>

      {/* Try for free — outlined sharp button per design.md */}
      <GoogleSignInButton
        style={{
          height: 40,
          paddingInline: 16,
          alignItems: "center",
          border: "1px solid #242424",
          borderRadius: 5,
          background: "transparent",
          fontSize: 13,
          fontWeight: 600,
          color: TEXT,
        }}
      >
        Try for free
      </GoogleSignInButton>
    </div>
  );
}

function MobileAuthSection() {
  const { user, isLoading, isAuthenticated } = useSessionView();
  const { handleLogout } = useGoogleAuthHandler();

  return (
    <div className="mt-5">
      <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-2 px-1">
        Account
      </p>
      <div
        className="rounded-2xl flex flex-col overflow-hidden"
        style={{ border: "1px solid #E7E0DC" }}
      >
        {isLoading ? (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <LoadingDots />
            <span style={{ fontSize: 14, color: TEXT }}>Signing in…</span>
          </div>
        ) : user && isAuthenticated ? (
          <>
            {/* User identity */}
            {(user.profile_image || user.name) && (
              <div
                className="flex items-center gap-3 px-4 py-3.5"
                style={{ borderBottom: "1px solid #E7E0DC" }}
              >
                {user.profile_image && (
                  <Image
                    src={user.profile_image}
                    alt={user.name ?? "User"}
                    width={30}
                    height={30}
                    className="rounded-full flex-none"
                  />
                )}
                <span style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>
                  {user.name}
                </span>
              </div>
            )}
            {/* Dashboard */}
            <a
              href="/dashboard"
              className="flex items-center gap-3 px-4 py-3.5"
              style={{
                borderBottom: "1px solid #E7E0DC",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: 600,
                color: TEXT,
              }}
            >
              <LayoutDashboard className="w-4 h-4 flex-none" />
              Dashboard
            </a>
            {/* Log out */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3.5 w-full"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#e53e3e",
                background: "none",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <LogOut className="w-4 h-4 flex-none" />
              Log out
            </button>
          </>
        ) : (
          <>
            <GoogleSignInButton
              className="flex items-center gap-3 px-4 py-3.5 w-full"
              style={{
                borderBottom: "1px solid #E7E0DC",
                fontSize: 14,
                fontWeight: 600,
                color: TEXT,
                textAlign: "left",
              }}
            >
              <LogIn className="w-4 h-4 flex-none" />
              Log in
            </GoogleSignInButton>
            <GoogleSignInButton
              className="flex items-center gap-3 px-4 py-3.5 w-full"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: TEXT,
                textAlign: "left",
              }}
            >
              Try for free →
            </GoogleSignInButton>
          </>
        )}
      </div>
    </div>
  );
}

export function Navbar() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const handleNavClick = (id: string) => {
    setMenuOpen(false);
    if (pathname !== "/") {
      router.push(`/#${id}`);
      return;
    }
    scrollToSection(id);
  };

  return (
    <header
      style={{
        background: BG,
        borderBottom: "1px solid #E7E0DC",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Main bar */}
      <div className="flex items-center justify-between h-16 px-6 sm:px-10 md:px-20 xl:px-28">
        {/* Logo + nav links grouped left */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-center gap-[9px] md:gap-3 flex-none"
            style={{ textDecoration: "none" }}
          >
            <Image
              src="/images/neylonai-logo.jpg"
              alt="Neylon AI"
              width={32}
              height={32}
              className="h-8 w-8 object-contain rounded-sm"
              priority
            />
            <span
              className="landing-strong text-[16px] md:text-[15px] lg:text-[18px]"
              style={{ color: TEXT }}
            >
              Neylon AI
            </span>
          </Link>

          {/* Desktop nav links — directly beside logo */}
          <nav className="hidden md:flex items-center" style={{ gap: 24 }}>
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                onClick={() => handleNavClick(link.id)}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: TEXT,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                {link.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Desktop auth */}
        <div className="hidden md:flex items-center">
          <NavAuthButtons />
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 4,
          }}
        >
          {menuOpen ? (
            <X className="w-5 h-5" style={{ color: TEXT }} />
          ) : (
            <Menu className="w-5 h-5" style={{ color: TEXT }} />
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            style={{ background: BG, borderTop: "1px solid #E7E0DC", overflow: "hidden" }}
            className="md:hidden"
          >
            <div className="px-6 sm:px-10 pt-4 pb-6 flex flex-col">
              {/* Section label */}
              <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold mb-1 px-1">
                Menu
              </p>

              {/* Nav links */}
              <nav className="flex flex-col">
                {NAV_LINKS.map((link) => (
                  <button
                    key={link.id}
                    onClick={() => handleNavClick(link.id)}
                    style={{
                      textAlign: "left",
                      padding: "11px 4px",
                      fontSize: 15,
                      fontWeight: 600,
                      color: TEXT,
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid #E7E0DC",
                      cursor: "pointer",
                    }}
                  >
                    {link.label}
                  </button>
                ))}
              </nav>

              {/* Account section */}
              <MobileAuthSection />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
